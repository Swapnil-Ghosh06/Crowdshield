import React from 'react';
import { TrendView } from '../components/TrendView';
import { RawEventStream } from '../components/RawEventStream';

export function AnalyticsPage({ history, events, lastEvent }) {
  return (
    <div className="space-y-5 animate-fade-in-up">
      <TrendView history={history} events={events} />
      <RawEventStream lastEvent={lastEvent} />
    </div>
  );
}
