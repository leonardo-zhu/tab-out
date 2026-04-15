import { useState, useEffect } from 'react';
import { getUserName, getGreeting } from '../utils/helpers';
import { Clock } from './Clock';

export function Greeting() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    getUserName().then(setUserName);
  }, []);

  return (
    <header>
      <div className="header-left">
        <h1>{getGreeting(userName)}</h1>
        <Clock />
      </div>
    </header>
  );
}
