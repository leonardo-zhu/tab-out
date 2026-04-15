import { useState, useEffect } from 'react';
import { getDateDisplay } from '../utils/helpers';

export function Clock() {
  const [dateTime, setDateTime] = useState(getDateDisplay());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(getDateDisplay());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <div className="date">{dateTime}</div>;
}
