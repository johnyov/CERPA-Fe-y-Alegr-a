import React, { createContext, useContext, useState } from 'react';

interface ModalContextType {
  isAddBookModalOpen: boolean;
  openAddBookModal: () => void;
  closeAddBookModal: () => void;
  isUnlocked: boolean;
  setIsUnlocked: (value: boolean) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const openAddBookModal = () => setIsAddBookModalOpen(true);
  const closeAddBookModal = () => setIsAddBookModalOpen(false);

  return (
    <ModalContext.Provider value={{ 
      isAddBookModalOpen, 
      openAddBookModal, 
      closeAddBookModal,
      isUnlocked,
      setIsUnlocked
    }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
