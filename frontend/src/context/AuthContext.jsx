import { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../api/index.js';

const AuthContext = createContext(null);

const initialState = { user: null, loading: true, error: null };

const extractUser = (data) => data?.data?.user || data?.data || null;

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER': return { ...state, user: action.payload, loading: false, error: null };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload, loading: false };
    case 'LOGOUT': return { user: null, loading: false, error: null };
    default: return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authAPI.getMe()
        .then(({ data }) => dispatch({ type: 'SET_USER', payload: extractUser(data) }))
        .catch(() => { localStorage.clear(); dispatch({ type: 'LOGOUT' }); });
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    const { accessToken, refreshToken, user } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userId', user._id);
    dispatch({ type: 'SET_USER', payload: user });
    return user;
  };

  const register = async (info) => {
    const { data } = await authAPI.register(info);
    const { accessToken, refreshToken, user } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userId', user._id);
    dispatch({ type: 'SET_USER', payload: user });
    return user;
  };

  const registerAdmin = async (info) => {
    const { data } = await authAPI.registerAdmin(info);
    const { accessToken, refreshToken, user } = data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userId', user._id);
    dispatch({ type: 'SET_USER', payload: user });
    return user;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    // Clear only auth tokens, preserve cart and favorites for guest
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, registerAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
};
