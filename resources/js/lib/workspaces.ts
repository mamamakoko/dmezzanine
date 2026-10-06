export type Area = 'pos' | 'menu' | 'marketing' | 'inventory' | 'owner' | 'sales' | 'count' | 'report';

export interface Workspace {
    area: Area;
    title: string;
    kicker: string;
    body: string;
}

/**
 * Every workspace in Landing order. Each area's route is named after the area (route('pos'), route('menu') …).
 */
export const WORKSPACES: Workspace[] = [
    { area: 'pos', title: 'POS', kicker: 'Till', body: 'Take orders, apply discounts and close out shifts. Starts on the login screen.' },
    {
        area: 'menu',
        title: 'Branch menu',
        kicker: 'Front of house',
        body: 'The menu board without prices — take orders and send tickets to the kitchen.',
    },
    { area: 'marketing', title: 'Marketing', kicker: 'Field sales', body: 'Take orders off-site and send them to the branch that will make them.' },
    { area: 'inventory', title: 'Inventory', kicker: 'Back office', body: 'Stock, shopping lists, transfers, locations and the activity log.' },
    { area: 'owner', title: 'Owner console', kicker: 'Owner only', body: 'User control — accounts, access and page permissions.' },
    { area: 'sales', title: 'Sales', kicker: 'Reporting', body: 'Daily takings, item performance, payment mix and the VAT breakdown.' },
    { area: 'count', title: 'Stock count', kicker: 'Branch', body: 'End-of-day count per station, checked against expected on hand.' },
    {
        area: 'report',
        title: 'Stock report',
        kicker: 'Reporting',
        body: 'The month per item — beginning, received from the warehouse, ending and movement.',
    },
];
