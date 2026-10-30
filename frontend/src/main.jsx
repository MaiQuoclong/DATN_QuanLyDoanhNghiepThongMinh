import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { NhaCungCapXacThuc } from './context/NguCanhXacThuc';
import './styles/bienMau.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <NhaCungCapXacThuc>
        <App />
      </NhaCungCapXacThuc>
    </BrowserRouter>
  </StrictMode>
);
