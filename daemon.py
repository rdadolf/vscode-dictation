#!/usr/bin/env python3
"""Simple Dictation audio daemon."""

import asyncio
import json
import logging
import os
import sys
import tempfile
from argparse import ArgumentParser

import numpy as np
import sounddevice as sd
import soundfile as sf
import websockets

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)

SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'


class Recorder:
    def __init__(self) -> None:
        self._stream: sd.InputStream | None = None
        self._chunks: list[np.ndarray] = []

    def _callback(self, indata: np.ndarray, frames: int, time, status: sd.CallbackFlags) -> None:
        if status:
            log.warning('Audio callback status: %s', status)
        # indata shape is (frames, CHANNELS); copy before appending since the buffer is reused
        self._chunks.append(indata.copy())

    def start(self) -> None:
        self._chunks = []
        self._stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype=DTYPE,
            callback=self._callback,
        )
        self._stream.start()

    def stop(self) -> np.ndarray:
        self._stream.stop()
        self._stream.close()
        self._stream = None
        audio = np.concatenate(self._chunks, axis=0) if self._chunks else np.zeros((0, CHANNELS), dtype=DTYPE)
        self._chunks = []
        return audio

    @property
    def recording(self) -> bool:
        return self._stream is not None


async def handler(websocket) -> None:
    recorder = Recorder()
    log.info('Client connected')
    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                log.warning('Received invalid JSON: %r', raw)
                await websocket.send(json.dumps({'status': 'error', 'message': 'invalid JSON'}))
                continue

            cmd = msg.get('cmd')
            log.info('Received: %s', msg)

            if cmd == 'start':
                if recorder.recording:
                    log.warning('start received while already recording; ignoring')
                    await websocket.send(json.dumps({'status': 'error', 'message': 'already recording'}))
                    continue
                recorder.start()
                log.info('Recording started')
                await websocket.send(json.dumps({'status': 'ok'}))

            elif cmd == 'stop':
                if not recorder.recording:
                    log.warning('stop received while not recording; ignoring')
                    await websocket.send(json.dumps({'status': 'error', 'message': 'not recording'}))
                    continue
                audio = recorder.stop()

                fd, tmp_path = tempfile.mkstemp(suffix='.flac')
                os.close(fd)
                sf.write(tmp_path, audio, SAMPLE_RATE)
                log.info('Recording saved to %s (%d frames)', tmp_path, len(audio))

                await websocket.send(json.dumps({'status': 'ok', 'path': tmp_path}))

                # TODO(DEV-23): Delete after Groq has read the file, not immediately.
                # For now the extension only logs the path, so it's safe to clean up here.
                os.remove(tmp_path)
                log.info('Deleted temp file %s', tmp_path)

            else:
                log.warning('Unknown command: %r', cmd)
                await websocket.send(json.dumps({'status': 'error', 'message': f'unknown command: {cmd}'}))

    except websockets.ConnectionClosedOK:
        pass
    finally:
        # Clean up if the client disconnects mid-recording
        if recorder.recording:
            log.warning('Client disconnected mid-recording; stopping stream')
            recorder.stop()
        log.info('Client disconnected')


async def main(port: int) -> None:
    log.info('Starting daemon on ws://localhost:%d', port)
    try:
        async with websockets.serve(handler, 'localhost', port):
            log.info('Daemon ready')
            await asyncio.Future()  # run forever
    except OSError as e:
        log.error('Failed to bind to port %d: %s', port, e)
        sys.exit(1)


if __name__ == '__main__':
    parser = ArgumentParser(description='Simple Dictation audio daemon')
    parser.add_argument('--port', type=int, default=49152)
    args = parser.parse_args()
    asyncio.run(main(args.port))
