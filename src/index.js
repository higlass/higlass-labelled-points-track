import register from 'higlass-register';

import LabelledPointTrack from './LabelledPointTrack';

register({
  name: 'LabelledPointTrack',
  track: LabelledPointTrack,
  config: LabelledPointTrack.config,
});

export default LabelledPointTrack;
