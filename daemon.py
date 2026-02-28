#!/usr/bin/env python3
"""Simple Dictation audio daemon."""

import asyncio
import json
import logging
import sys
from argparse import ArgumentParser

import websockets

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)


async def handler(websocket) -> None:
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
                await websocket.send(json.dumps({'status': 'ok'}))
            elif cmd == 'stop':
                await websocket.send(json.dumps({'status': 'ok', 'path': None}))
            else:
                log.warning('Unknown command: %r', cmd)
                await websocket.send(json.dumps({'status': 'error', 'message': f'unknown command: {cmd}'}))
    except websockets.ConnectionClosedOK:
        pass
    finally:
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
