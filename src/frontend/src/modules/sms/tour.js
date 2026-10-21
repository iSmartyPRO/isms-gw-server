export default {
  id: 'sms',
  module: 'sms',
  version: 1,
  route: '/app/sms',
  title: 'tour.sms.title',
  steps: [
    { id: 'intro', title: 'tour.sms.intro.title', text: 'tour.sms.intro.text' },
    { id: 'devices', target: 'sms.devices', placement: 'right', title: 'tour.sms.devices.title', text: 'tour.sms.devices.text' },
    { id: 'compose', target: 'sms.compose', placement: 'right', title: 'tour.sms.compose.title', text: 'tour.sms.compose.text' },
    { id: 'nav', target: 'sms.nav', placement: 'right', title: 'tour.sms.nav.title', text: 'tour.sms.nav.text' },
    { id: 'api', title: 'tour.sms.api.title', text: 'tour.sms.api.text' },
  ],
};
