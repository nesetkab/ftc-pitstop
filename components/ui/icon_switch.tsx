import React, { useState } from 'react';

interface SwitchOption {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface IconSwitchProps {
  options: SwitchOption[];
  defaultSelected?: string;
  onSelectionChange?: (selectedId: string) => void;
}

const IconSwitch: React.FC<IconSwitchProps> = ({
  options,
  defaultSelected,
  onSelectionChange
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    defaultSelected || options[0]?.id || ''
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectionChange?.(id);
  };

  return (
    <div className="flex items-center bg-white dark:bg-black border border-black dark:border-white rounded-3xl p-1 gap-1">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        return (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={`
              flex items-center px-3 py-2 rounded-2xl transition-all duration-200 ease-in-out
              ${isSelected
                ? 'bg-white shadow-sm dark:text-black text-white font-medium gap-2 '
                : 'text-white hover:text-gray-800 hover:bg-gray-200'
              }
            `}
          >
            <span className="flex-shrink-0">
              {option.icon}
            </span>
            <span
              className={`
                transition-all duration-200 ease-in-out overflow-hidden whitespace-nowrap
                ${isSelected ? 'max-w-32 opacity-100' : 'max-w-0 opacity-0'}
              `}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default IconSwitch;
