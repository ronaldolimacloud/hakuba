import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer as NodeBuffer } from 'buffer';

type GlobalWithBuffer = typeof globalThis & { Buffer?: typeof NodeBuffer };

if (typeof (globalThis as GlobalWithBuffer).Buffer === 'undefined') {
  (globalThis as GlobalWithBuffer).Buffer = NodeBuffer;
}


