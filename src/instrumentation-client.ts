import { initBotId } from 'botid/client/core'

// Vercel BotID. The challenge only runs on these paths, and `checkBotId()` on
// the server fails closed for any path that is not listed here — so this list
// and the checks in the actions must be changed together.
//
// Server Actions post to the path of the page that invoked them, which is why
// these are page routes rather than the action names. Every one of them is
// unauthenticated and expensive to abuse: card testing, credential stuffing,
// signup floods, and password-reset mail bombs.
initBotId({
  protect: [
    { path: '/checkout', method: 'POST' },
    { path: '/account/login', method: 'POST' },
    { path: '/account/register', method: 'POST' },
    { path: '/account/forgot', method: 'POST' },
  ],
})
