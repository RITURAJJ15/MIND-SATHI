import React from 'react';
import { Brain, UserCheck, Stethoscope, ShieldCheck, ArrowRight } from 'lucide-react';
import type { AuthScreen, AuthRole } from '../../types/auth';

interface SelectRolePageProps {
  onNavigateAuth: (screen: AuthScreen) => void;
  onSelectRole: (role: AuthRole) => void;
}

const ROLES: {
  value: AuthRole;
  label: string;
  subtitle: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  gradient: string;
  border: string;
  ring: string;
  badge: string;
}[] = [
  {
    value: 'elderly',
    label: 'Elderly User',
    subtitle: 'For individuals aged 55+',
    description: 'Play personalised cognitive games, track your memory health, and stay connected with family.',
    icon: Brain,
    gradient: 'from-sathi-600 to-amber-500',
    border: 'border-sathi-200 hover:border-sathi-400',
    ring: 'hover:ring-sathi-200',
    badge: 'bg-sathi-50 text-sathi-700',
  },
  {
    value: 'caregiver',
    label: 'Caregiver',
    subtitle: 'Family member or personal caregiver',
    description: 'Monitor your loved ones cognitive engagement, daily activities, and receive health insights.',
    icon: UserCheck,
    gradient: 'from-sage-600 to-sage-400',
    border: 'border-sage-200 hover:border-sage-400',
    ring: 'hover:ring-sage-200',
    badge: 'bg-sage-50 text-sage-700',
  },
  {
    value: 'clinician',
    label: 'Healthcare Professional',
    subtitle: 'Doctor, therapist, or specialist',
    description: 'Access clinical dashboards, cognitive performance analytics, and authorised patient reports.',
    icon: Stethoscope,
    gradient: 'from-calm-blue to-blue-400',
    border: 'border-blue-200 hover:border-blue-400',
    ring: 'hover:ring-blue-200',
    badge: 'bg-blue-50 text-blue-700',
  },
  {
    value: 'admin',
    label: 'Administrator',
    subtitle: 'Platform or organisation admin',
    description: 'Manage users, configure system settings, and oversee the MIND SATHI ecosystem.',
    icon: ShieldCheck,
    gradient: 'from-calm-gold to-amber-400',
    border: 'border-amber-200 hover:border-amber-400',
    ring: 'hover:ring-amber-200',
    badge: 'bg-amber-50 text-amber-700',
  },
];

export const SelectRolePage: React.FC<SelectRolePageProps> = ({ onNavigateAuth, onSelectRole }) => {
  return (
    <div className="bg-white rounded-3xl shadow-elder p-8 sm:p-10">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Who are you joining as?</h1>
        <p className="text-sm text-gray-500 mt-1.5">Choose your role to get started with the right experience</p>
      </div>

      <div className="space-y-3">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <button
              key={role.value}
              type="button"
              onClick={() => onSelectRole(role.value)}
              className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-150 cursor-pointer group ring-4 ring-transparent ${role.border} ${role.ring} active:scale-[0.98]`}
            >
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-tr ${role.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-150`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-gray-900 text-sm">{role.label}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${role.badge}`}>{role.subtitle}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{role.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
            </button>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <button type="button" onClick={() => onNavigateAuth('login')} className="font-bold text-sathi-600 hover:text-sathi-700 transition-colors">
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
};
