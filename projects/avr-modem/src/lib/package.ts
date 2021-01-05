export interface Package {
  cmd: PackageCmd;
  message: string;
  size: number;
  messageStream: Float32Array;
}

export enum PackageCmd {
  MESSAGE = 0,
}
