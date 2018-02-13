/* eslint-env browser */
/* global io */

// previous comments are to set up eslint for browser use
// I wanted to eslint the browser code for my own sanity

const init = () => {
  const canvas = document.querySelector('canvas');
  canvas.width = 500;
  canvas.height = 500;
  canvas.style.border = '1px solid blue';
  // const ctx = canvas.getContext('2d');

  const socket = io.connect();

  socket.on('connect', () => {
    // TODO socket connection
  });


  // TODO setup socket event handlers
};

window.onload = init;
