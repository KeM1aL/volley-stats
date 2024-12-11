import { Subject, Observable } from 'rxjs';
import { SyncEvent } from './types';

export class SyncEventEmitter {
  private eventSubject = new Subject<SyncEvent>();

  emit(event: SyncEvent): void {
    this.eventSubject.next(event);
  }

  onEvent(): Observable<SyncEvent> {
    return this.eventSubject.asObservable();
  }

  onCollectionEvent(collection: string): Observable<SyncEvent> {
    return new Observable<SyncEvent>(subscriber => {
      const subscription = this.eventSubject.subscribe(event => {
        if (event.collection === collection) {
          subscriber.next(event);
        }
      });

      return () => subscription.unsubscribe();
    });
  }
}