import { TestBed } from '@angular/core/testing';

import { Asvs } from './asvs';

describe('Asvs', () => {
  let service: Asvs;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Asvs);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
