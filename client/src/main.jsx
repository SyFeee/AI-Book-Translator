import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ChakraProvider, extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      }
    }
  },
  colors: {
    brand: {
      50: '#f0f4ff',
      100: '#d9e2ff',
      200: '#b3c5ff',
      300: '#8da8ff',
      400: '#678bff',
      500: '#4169e1', // Royal Blue as the primary color
      600: '#3451b2',
      700: '#263983',
      800: '#1a2754',
      900: '#0d1425',
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)
