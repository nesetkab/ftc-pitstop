import '@testing-library/jest-dom/vitest';
import * as streams from 'node:stream/web';

globalThis.ReadableStream ??= streams.ReadableStream as typeof ReadableStream;
globalThis.WritableStream ??= streams.WritableStream as typeof WritableStream;
globalThis.TransformStream ??= streams.TransformStream as typeof TransformStream;
globalThis.CompressionStream ??= streams.CompressionStream as typeof CompressionStream;
globalThis.DecompressionStream ??= streams.DecompressionStream as typeof DecompressionStream;
