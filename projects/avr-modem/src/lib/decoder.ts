import { Profile } from './profile';
import { Observable, Subject } from 'rxjs';
import { Package } from './package';

export abstract class Decoder {
  abstract profile: Profile;
  abstract sampleRate: number;
  abstract onReceive: Observable<Package>;
  abstract demod(samples: Float32Array): void;
}
