// Quickview dialog TRẮNG (placeholder)
// - Đóng bằng X, backdrop, Esc

import React from 'react';
import { Modal } from 'antd';

const QuickviewDialog = ({ open, on_close }) => {
  return (
    <Modal
      title='Preview'
      open={open}
      onCancel={on_close}
      footer={null}
      centered
      width={960}
      destroyOnClose
      maskClosable
    >
      <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#999' }}>Quickview coming soon</span>
      </div>
    </Modal>
  );
};

export default QuickviewDialog;
