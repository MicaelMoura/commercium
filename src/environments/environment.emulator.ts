// Exclusivo do ambiente local. Nunca aponta para um projeto Firebase real.
export const environment = {
  production: false,
  emulators: true,
  firebaseConfig: {
    apiKey: 'demo-api-key', authDomain: 'demo-commercium-functions.firebaseapp.com',
    projectId: 'demo-commercium-functions', storageBucket: 'demo-commercium-functions.appspot.com',
    messagingSenderId: '1234567890', appId: '1:1234567890:web:demo',
  },
};
