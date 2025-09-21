import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link';
  };
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  children
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex items-center justify-center min-h-[200px] p-8',
      className
    )}>
      <div className="text-center max-w-md">
        {Icon && (
          <Icon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        )}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-muted-foreground mb-4">{description}</p>
        )}
        {action && (
          <Button
            variant={action.variant || 'default'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}