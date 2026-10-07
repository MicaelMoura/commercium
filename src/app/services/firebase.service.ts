import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, connectAuthEmulator } from 'firebase/auth';
import { Functions, getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import {
  DocumentData,
  Firestore,
  Query,
  getFirestore,
  connectFirestoreEmulator,
  onSnapshot,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp = getApps().length > 0
    ? getApp()
    : initializeApp(environment.firebaseConfig);

  readonly auth: Auth = getAuth(this.app);
  readonly firestore: Firestore = getFirestore(this.app);
  readonly functions: Functions = getFunctions(this.app, 'southamerica-east1');
  constructor() {
    if ('emulators' in environment && environment.emulators === true) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(this.firestore, '127.0.0.1', 8080);
      connectFunctionsEmulator(this.functions, '127.0.0.1', 5001);
    }
  }
}

export function collectionData$<T>(
  source: Query<DocumentData>,
  idField: keyof T,
): Observable<T[]> {
  return new Observable<T[]>((subscriber) => onSnapshot(
    source,
    (snapshot) => subscriber.next(snapshot.docs.map((document) => ({
      ...document.data(),
      [idField]: document.id,
    }) as T)),
    (error) => subscriber.error(error),
  ));
}
