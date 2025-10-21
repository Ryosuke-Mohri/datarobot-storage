import * as React from 'react';
import { SidebarContextProps } from '@/types';

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider.');
    }

    return context;
}
export { SidebarContext, useSidebar };
