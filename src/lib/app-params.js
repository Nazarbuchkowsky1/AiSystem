export const appParams = {
  appId: 'local',
  token: localStorage.getItem('auth_token') || null,
  functionsVersion: 'local',
  appBaseUrl: window.location.origin,
};
