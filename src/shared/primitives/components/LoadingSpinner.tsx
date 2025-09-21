import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12'
};

export function LoadingSpinner({
  size = 'md',
  className,
  children
}: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center">
      <div className="text-center">
        <div className={cn(
          'animate-spin rounded-full border-2 border-muted border-t-primary mx-auto mb-2',
          sizeMap[size],
          className
        )} />
        {children && (
          <p className="text-muted-foreground text-sm">{children}</p>
        )}
      </div>
    </div>
  );
}