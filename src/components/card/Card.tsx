import {type ReactNode } from "react";
import { cx } from '../../utils/cx'

interface CardProps {
    className?: string;
    children: ReactNode;
}

export function Card({ className, children }: CardProps) {
    return (
        <div className={cx('bg-white shadow-md rounded-md p-4 dark:bg-black', className)}>
            {children}
        </div>
    );
}

interface CardContentProps {
    className?: string;
    children: ReactNode;
}

export function CardContent({ className, children }: CardContentProps) {
    return (
        <div className={cx('p-2 flex-1', className)}>
            {children}
        </div>
    );
}