import styled from 'styled-components';
import { palette } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// Animation constants
const CARD_TRANSITION = 'transform 0.2s ease-in-out';
const HOVER_ELEVATION = '0 4px 8px rgba(0, 0, 0, 0.1)';

// Helper function to determine status color
const getStatusColor = (completed: boolean): string => {
  return completed ? palette.primary.base : palette.alert.base;
};

export const ScheduleContainer = styled.div`
  padding: ${spacing.medium};
  display: flex;
  flex-direction: column;
  gap: ${spacing.small};
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;

  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
    }
  }
`;

export const ScheduleList = styled.div`
  display: grid;
  grid-gap: ${spacing.medium};
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  width: 100%;

  @supports not (display: grid) {
    display: flex;
    flex-wrap: wrap;
    gap: ${spacing.medium};
  }
`;

export const ScheduleCard = styled.div<{ completed?: boolean }>`
  background: ${({ theme }) => theme.palette.background};
  border-radius: 8px;
  padding: ${spacing.medium};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: ${CARD_TRANSITION};
  border-left: 4px solid ${({ completed }) => getStatusColor(completed || false)};
  position: relative;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${HOVER_ELEVATION};
  }

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.palette.primary.base};
    outline-offset: 2px;
  }
`;

export const TaskTitle = styled.h3`
  ${typography.h3};
  color: ${({ theme }) => theme.palette.text};
  margin: 0 0 ${spacing.small};
`;

export const TaskDescription = styled.p`
  ${typography.body1};
  color: ${({ theme }) => theme.palette.text};
  margin: 0 0 ${spacing.small};
`;

export const DueDate = styled.span`
  ${typography.body2};
  color: ${({ theme }) => theme.palette.secondary.dark};
  display: block;
  margin-bottom: ${spacing.small};
`;

export const CompletionStatus = styled.div<{ completed: boolean }>`
  display: flex;
  align-items: center;
  gap: ${spacing.small};
  color: ${({ completed, theme }) => 
    completed ? theme.palette.primary.base : theme.palette.alert.base};
  ${typography.body2};

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: currentColor;
  }
`;

export const NotificationPreferences = styled.div`
  background: ${({ theme }) => theme.palette.background};
  border-radius: 8px;
  padding: ${spacing.medium};
  margin-top: ${spacing.medium};
  border: 1px solid ${({ theme }) => theme.palette.secondary.light};

  & > * + * {
    margin-top: ${spacing.small};
  }
`;

export const PreferenceItem = styled.label`
  display: flex;
  align-items: center;
  gap: ${spacing.small};
  ${typography.body1};
  color: ${({ theme }) => theme.palette.text};
  cursor: pointer;

  input {
    accent-color: ${({ theme }) => theme.palette.primary.base};
  }
`;

export const TimeSelector = styled.select`
  ${typography.body2};
  padding: ${spacing.small};
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.palette.secondary.light};
  background-color: white;
  color: ${({ theme }) => theme.palette.text};
  width: 100%;
  max-width: 200px;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.palette.primary.base};
    outline-offset: 2px;
  }
`;

export const FilterBar = styled.div`
  display: flex;
  gap: ${spacing.medium};
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: ${spacing.medium};
  padding: ${spacing.small};
  background: ${({ theme }) => theme.palette.background};
  border-radius: 4px;
`;

export const FilterButton = styled.button<{ active?: boolean }>`
  ${typography.button};
  padding: ${spacing.small} ${spacing.medium};
  border-radius: 4px;
  border: 1px solid ${({ theme, active }) => 
    active ? theme.palette.primary.base : theme.palette.secondary.light};
  background: ${({ theme, active }) => 
    active ? theme.palette.primary.light : 'transparent'};
  color: ${({ theme, active }) => 
    active ? theme.palette.primary.dark : theme.palette.text};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.palette.primary.light};
    border-color: ${({ theme }) => theme.palette.primary.base};
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.palette.primary.base};
    outline-offset: 2px;
  }
`;