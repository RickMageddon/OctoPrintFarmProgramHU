// Fix for Dev Server allowedHosts bug in react-scripts 5.x
module.exports = {
  devServer: {
    allowedHosts: 'all',
  },
};
