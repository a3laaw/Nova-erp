import Fuse from 'fuse.js';

const defaultOptions: Fuse.IFuseOptions<any> = {
    includeScore: true,
    threshold: 0.3,
    minMatchCharLength: 2,
};

function createFuseSearch<T>(defaultKeys: (keyof T | string)[], defaultThreshold = 0.3) {
    return (items: T[], query: string, keys?: (keyof T | string)[], threshold?: number): T[] => {
        if (!query) {
            return items;
        }

        const fuse = new Fuse(items, {
            ...defaultOptions,
            keys: (keys || defaultKeys) as any,
            threshold: threshold || defaultThreshold,
        });

        return fuse.search(query).map(result => result.item);
    };
}

export const searchClients = createFuseSearch(
    ['nameAr', 'nameEn', 'fileId', 'mobile'], 
    0.4
);

export const searchEmployees = createFuseSearch(
    ['fullName', 'employeeNumber', 'civilId'], 
    0.4
);

export const searchAccounts = createFuseSearch(
    ['name', 'code'], 
    0.3
);
