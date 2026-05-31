'use client';

import { RefreshCw } from 'lucide-react';
import { InventoryAddItemModal } from './components/InventoryAddItemModal';
import { InventoryCreateRequestModal } from './components/InventoryCreateRequestModal';
import { InventoryLogsPanel } from './components/InventoryLogsPanel';
import { InventoryPageHeader } from './components/InventoryPageHeader';
import { InventoryReconciliationPanel } from './components/InventoryReconciliationPanel';
import { InventoryRestockModal } from './components/InventoryRestockModal';
import { InventoryStockPanel } from './components/InventoryStockPanel';
import { InventoryTabs } from './components/InventoryTabs';
import { InventoryTransferOrdersPanel } from './components/InventoryTransferOrdersPanel';
import { useInventoryPageState } from './hooks/useInventoryPageState';

export default function InventoryPage() {
  const {
    activeTab,
    setActiveTab,
    items,
    loading,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    orders,
    loadingOrders,
    showCreateRequest,
    setShowCreateRequest,
    requestCart,
    setRequestCart,
    selectedItemIndex,
    setSelectedItemIndex,
    requestQty,
    setRequestQty,
    requestNotes,
    setRequestNotes,
    submittingOrder,
    logMonth,
    setLogMonth,
    logYear,
    setLogYear,
    restockTarget,
    setRestockTarget,
    restockAmt,
    setRestockAmt,
    submitting,
    showAdd,
    setShowAdd,
    newItem,
    setNewItem,
    reconMonth,
    setReconMonth,
    reconYear,
    setReconYear,
    reconRows,
    reconLoading,
    reconSaving,
    filteredItems,
    filteredLogs,
    lowCount,
    handleSaveReconciliation,
    updateReconRow,
    handleRestock,
    handleAddItem,
    addToCart,
    removeFromCart,
    submitTransferOrder,
    handleConfirmReceipt,
    handleCancelOrder,
  } = useInventoryPageState();
  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <RefreshCw className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto space-y-10">

      <InventoryPageHeader totalItems={items.length} lowCount={lowCount} />

      <InventoryTabs activeTab={activeTab} onChange={setActiveTab} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">

        <div className="xl:col-span-2">
          {activeTab === 'stock' ? (
            <InventoryStockPanel
              items={items}
              filteredItems={filteredItems}
              lowCount={lowCount}
              search={search}
              stockFilter={stockFilter}
              setSearch={setSearch}
              setStockFilter={setStockFilter}
              setShowAdd={setShowAdd}
              setRestockTarget={setRestockTarget}
              setRestockAmt={setRestockAmt}
              setRequestCart={setRequestCart}
              setShowCreateRequest={setShowCreateRequest}
            />
          ) : activeTab === 'requests' ? (
            <InventoryTransferOrdersPanel
              orders={orders}
              loadingOrders={loadingOrders}
              onCreateRequest={() => {
                setRequestCart([]);
                setSelectedItemIndex(-1);
                setRequestQty(0);
                setRequestNotes('');
                setShowCreateRequest(true);
              }}
              onCancelOrder={handleCancelOrder}
              onConfirmReceipt={handleConfirmReceipt}
            />
          ) : (
            <InventoryReconciliationPanel
              reconMonth={reconMonth}
              reconYear={reconYear}
              reconRows={reconRows}
              reconLoading={reconLoading}
              reconSaving={reconSaving}
              setReconMonth={setReconMonth}
              setReconYear={setReconYear}
              updateReconRow={updateReconRow}
              handleSaveReconciliation={handleSaveReconciliation}
            />
          )}
        </div>
        <InventoryLogsPanel
          logs={filteredLogs}
          logMonth={logMonth}
          logYear={logYear}
          setLogMonth={setLogMonth}
          setLogYear={setLogYear}
        />
      </div>

      <InventoryRestockModal
        target={restockTarget}
        restockAmt={restockAmt}
        submitting={submitting}
        setRestockAmt={setRestockAmt}
        onClose={() => setRestockTarget(null)}
        onSubmit={handleRestock}
      />

      <InventoryCreateRequestModal
        show={showCreateRequest}
        items={items}
        requestCart={requestCart}
        selectedItemIndex={selectedItemIndex}
        requestQty={requestQty}
        requestNotes={requestNotes}
        submittingOrder={submittingOrder}
        setSelectedItemIndex={setSelectedItemIndex}
        setRequestQty={setRequestQty}
        setRequestNotes={setRequestNotes}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        submitTransferOrder={submitTransferOrder}
        onClose={() => setShowCreateRequest(false)}
      />

      <InventoryAddItemModal
        show={showAdd}
        newItem={newItem}
        submitting={submitting}
        setNewItem={setNewItem}
        onClose={() => setShowAdd(false)}
        onSubmit={handleAddItem}
      />
    </div>
  );
}
