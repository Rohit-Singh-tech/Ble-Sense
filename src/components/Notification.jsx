import React from 'react';

const Notification = ({ notification }) => {
  if (!notification) return null;

  return (
    <div className={`notification-banner ${notification.type}`}>
      {notification.message}
    </div>
  );
};

export default Notification;
