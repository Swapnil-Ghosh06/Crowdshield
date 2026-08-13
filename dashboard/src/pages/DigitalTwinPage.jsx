import React from 'react';
import { DigitalTwin } from '../components/DigitalTwin';

export function DigitalTwinPage({ events }) {
  return (
    <div className="animate-fade-in-up">
      <DigitalTwin events={events} />
    </div>
  );
}
