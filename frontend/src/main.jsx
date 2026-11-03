import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme.css';

class ErrorBoundary extends React.Component {
  state = {error:null};
  static getDerivedStateFromError(error) {return {error};}
  render() {return this.state.error ? <main><h1>页面暂时无法显示</h1><p>数据仍保存在数据库中。请刷新重试。</p><button className="button" onClick={()=>location.reload()}>刷新页面</button></main> : this.props.children;}
}

createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
