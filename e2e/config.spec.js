import { test, expect } from '@playwright/test';
import { mockVoice } from './helpers.js';

// Régression V11.1 : la page ignorait la configuration du serveur quand la version
// ne commençait pas par « 10. » (le serveur annonce 11.x). Résultat : jamais de voix
// tunisienne ni de streaming, même sur un serveur correctement configuré.
const serverConfig = extra => ({
  version: '11.1.0', backend: true, voicePath: 'voice', demo: true, demoReset: true,
  modes: { browser: true, voice: false, streaming: false },
  engines: { stt: null, tts: null }, ttsCache: false, signup: 'https://baarcha.tn/platform',
  streamMaxMinutes: 10, ...extra
});
const stubConfig = (page, config) => page.route('**/api/config', route => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(config)
}));

test('configuration 11.x adoptée : la voix tunisienne est proposée et sélectionnée', async ({ page }) => {
  await mockVoice(page);
  await stubConfig(page, serverConfig({ modes: { browser: true, voice: true, streaming: true }, engines: { stt: 'baarcha', tts: 'baarcha' }, ttsCache: true }));
  await page.goto('/');
  await expect(page.locator('#mode option[value=voice]')).toBeEnabled();
  await expect(page.locator('#mode option[value=streaming]')).toBeEnabled();
  await expect(page.locator('#mode')).toHaveValue('streaming');
  await expect(page.locator('#mode option[value=voice]')).toHaveText(/Voix tunisienne/);
  await page.locator('#mode').selectOption('voice');
  await page.locator('#start').click();
  // Le vrai serveur répond « voix serveur non configurée » (aucune clé) : la démo doit
  // continuer en mode gratuit au lieu de rester bloquée sur un mode indisponible.
  await expect(page.locator('.message.assistant')).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator('#errorBox')).toContainText(/baarcha\.tn|configurée/i);
  await expect(page.locator('#mode')).toHaveValue('browser');
  await expect(page.locator('#diagnosticList')).toContainText('Baarcha');
});

test('sans clé côté serveur : la voix du navigateur reste seule proposée', async ({ page }) => {
  await mockVoice(page);
  await stubConfig(page, serverConfig({}));
  await page.goto('/');
  await expect(page.locator('#mode option[value=streaming]')).toBeDisabled();
  await expect(page.locator('#mode option[value=voice]')).toBeDisabled();
  await expect(page.locator('#mode')).toHaveValue('browser');
  await expect(page.locator('#diagnosticList')).toContainText('BAARCHA_API_KEY');
});
