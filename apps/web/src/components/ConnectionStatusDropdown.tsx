import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DisplayConnectionStatus } from '@mobileworship/shared';

interface ConnectionStatusDropdownProps {
  statuses: DisplayConnectionStatus[];
}

export function ConnectionStatusDropdown({ statuses }: ConnectionStatusDropdownProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate summary status
  const connectedCount = statuses.filter(s => s.status === 'connected').length;
  const totalCount = statuses.length;
  const allConnected = connectedCount === totalCount && totalCount > 0;
  const someConnected = connectedCount > 0;

  // Summary indicator color
  const getSummaryColor = () => {
    if (totalCount === 0) return 'bg-gray-400';
    if (allConnected) return 'bg-green-500';
    if (someConnected) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Summary text
  const getSummaryText = () => {
    if (totalCount === 0) return t('control.noDisplays');
    if (allConnected) return t('control.allConnected', { count: totalCount });
    if (someConnected) return t('control.someConnected', { connected: connectedCount, total: totalCount });
    return t('control.disconnected');
  };

  // Status indicator for individual display
  const getStatusIndicator = (status: DisplayConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return <span className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'connecting':
        return <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
      case 'disconnected':
        return <span className="w-2 h-2 bg-red-500 rounded-full" />;
    }
  };

  const getStatusText = (status: DisplayConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return t('control.statusConnected');
      case 'connecting':
        return t('control.statusConnecting');
      case 'disconnected':
        return t('control.statusDisconnected');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <span className={`w-2 h-2 rounded-full ${getSummaryColor()} ${allConnected ? 'animate-pulse' : ''}`} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{getSummaryText()}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b dark:border-gray-700">
            <h3 className="font-medium text-sm">{t('control.displayStatus')}</h3>
          </div>
          {statuses.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {t('control.noDisplaysConfigured')}
            </div>
          ) : (
            <ul className="py-2">
              {statuses.map((displayStatus) => (
                <li
                  key={displayStatus.displayId}
                  className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIndicator(displayStatus.status)}
                    <span className="text-sm font-medium truncate max-w-[140px]">
                      {displayStatus.displayName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{getStatusText(displayStatus.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
