import { Profile } from './profile';
import { Package, PackageCmd } from './package';

export abstract class Encoder {
  abstract profile: Profile;
  abstract sampleRate: number;
  abstract modulate(message: string): Float32Array;
  abstract mkMsgPkg(msg: string): Package;
}
