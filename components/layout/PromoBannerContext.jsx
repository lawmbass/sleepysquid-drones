import { createContext, useContext, useState } from 'react';

const PromoBannerContext = createContext();

export const usePromoBanner = () => {
  const context = useContext(PromoBannerContext);
  if (!context) {
    throw new Error('usePromoBanner must be used within a PromoBannerProvider');
  }
  return context;
};

export const PromoBannerProvider = ({ children }) => {
  const [isPromoBannerVisible, setIsPromoBannerVisible] = useState(false);
  const [promoBannerHeight, setPromoBannerHeight] = useState(0);

  return (
    <PromoBannerContext.Provider 
      value={{
        isPromoBannerVisible,
        setIsPromoBannerVisible,
        promoBannerHeight,
        setPromoBannerHeight
      }}
    >
      {children}
    </PromoBannerContext.Provider>
  );
};