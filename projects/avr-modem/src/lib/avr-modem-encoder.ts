import { AvrModemProfile } from './avr-modem-profile';

export abstract class AvrModemEncoder {
  abstract profile: AvrModemProfile;
  abstract sampleRate: number;
  abstract modulate(message: string): Float32Array;
}

