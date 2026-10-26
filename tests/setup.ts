import { vi } from 'vitest';
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock Web Audio API
class MockAudioNode {
  connect() {
    return this;
  }
  disconnect() {}
}

class MockGainNode extends MockAudioNode {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    value: 1,
  };
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = { setValueAtTime: vi.fn(), value: -24 };
  knee = { setValueAtTime: vi.fn(), value: 30 };
  ratio = { setValueAtTime: vi.fn(), value: 12 };
  attack = { setValueAtTime: vi.fn(), value: 0.003 };
  release = { setValueAtTime: vi.fn(), value: 0.25 };
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    value: 440,
  };
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = new MockAudioNode();
  createGain() {
    return new MockGainNode();
  }
  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode();
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

// @ts-expect-error test mock
window.AudioContext = MockAudioContext;
// @ts-expect-error test mock
window.webkitAudioContext = MockAudioContext;

// Mock navigator.vibrate
if (!window.navigator.vibrate) {
  window.navigator.vibrate = vi.fn().mockReturnValue(true);
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
