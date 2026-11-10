import React, { useState } from 'react';

function BadComponent({ loggedIn }: { loggedIn: boolean }) {
  const [count, setCount] = useState(0);
  if (!loggedIn) {
    return React.createElement('div', null, 'Not logged in');
  }
  const [extra, setExtra] = useState(1);
  return React.createElement('div', null, 'Logged in ' + extra);
}

// In React, conditionally rendering hooks causes an invariant violation
console.log('BadComponent defined');
