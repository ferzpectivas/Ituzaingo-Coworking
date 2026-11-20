import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface LiveEvent {
  type: string;
  revision: number;
  at: string;
  spaceCode?: string;
  reservationId?: string;
}

@Injectable()
export class EventsService {
  private readonly subject = new Subject<LiveEvent>();

  emit(event: Omit<LiveEvent, 'at'> & { at?: string }): void {
    this.subject.next({ ...event, at: event.at ?? new Date().toISOString() });
  }

  stream() {
    return this.subject.asObservable();
  }
}
