import MatrixItemDS from '../data-source';

describe('the matrix item data source', () => {
    let MatrixItem;
    beforeEach(() => {
        MatrixItem = new MatrixItemDS();
    });
    it('returns an empty list for a blank guid', async () => {
        expect(await MatrixItem.getItemsFromGuid('')).toMatchSnapshot();
    });
});