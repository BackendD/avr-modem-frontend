import { TestBed } from '@angular/core/testing';

import { AvrModemService } from './avr-modem.service';

describe('AvrModemService', () => {
  let service: AvrModemService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AvrModemService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
