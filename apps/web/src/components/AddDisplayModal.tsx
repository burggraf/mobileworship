import { useState, FormEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSupabase, useAuth, claimDisplay } from '@mobileworship/shared';
import { useQueryClient } from '@tanstack/react-query';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddDisplayModal({ isOpen, onClose }: AddDisplayModalProps) {
  const { t } = useTranslation();
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'code' | 'name'>('code');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!isOpen) return null;

  const fullCode = code.join('');
  const isCodeComplete = fullCode.length === 6;

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];

    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split('');
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newCode[index] = value;
      setCode(newCode);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setError(null);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isCodeComplete) return;
    setStep('name');
  };

  const handleNameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('displays.add.nameRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await claimDisplay(
        supabase,
        fullCode,
        name.trim(),
        location.trim() || undefined
      );

      // Invalidate displays query to refresh list
      queryClient.invalidateQueries({ queryKey: ['displays', user?.churchId] });

      // Reset and close
      setCode(['', '', '', '', '', '']);
      setName('');
      setLocation('');
      setStep('code');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('displays.add.failed');
      if (message.includes('Invalid') || message.includes('expired')) {
        setError(t('displays.add.codeExpired'));
        setStep('code');
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setCode(['', '', '', '', '', '']);
      setName('');
      setLocation('');
      setStep('code');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden"
        role="dialog"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 id="modal-title" className="text-xl font-semibold">
            {step === 'code' ? t('displays.add.title') : t('displays.add.nameTitle')}
          </h2>
        </div>

        {step === 'code' ? (
          <form onSubmit={handleCodeSubmit}>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
                {t('displays.add.instructions')}
              </p>

              <div className="flex justify-center gap-2 mb-6">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    maxLength={6}
                    className="w-12 h-14 border-2 dark:border-gray-600 rounded-lg text-center text-2xl font-bold bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!isCodeComplete}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleNameSubmit}>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div>
                <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                  {t('displays.add.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
                  placeholder={t('displays.add.namePlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="displayLocation" className="block text-sm font-medium mb-1">
                  {t('displays.add.location')}
                </label>
                <input
                  id="displayLocation"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
                  placeholder={t('displays.add.locationPlaceholder')}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep('code')}
                disabled={isSubmitting}
                className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                {t('common.back')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('displays.add.pairing')}
                  </>
                ) : (
                  t('displays.add.complete')
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
