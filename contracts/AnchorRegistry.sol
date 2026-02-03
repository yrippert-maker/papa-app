// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * AnchorRegistry — минимальный контракт для anchoring Merkle root на Polygon.
 * Emits Anchored(root, periodStart, periodEnd, anchorId) для offline-аудита.
 */
contract AnchorRegistry {
    address public owner;
    mapping(bytes32 => bool) public published; // periodKey => published

    event Anchored(
        bytes32 indexed merkleRoot,
        uint64 periodStart,
        uint64 periodEnd,
        bytes32 indexed periodKey,
        bytes32 indexed anchorId
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not authorized");
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function publish(
        bytes32 merkleRoot,
        uint64 periodStart,
        uint64 periodEnd,
        bytes32 anchorId
    ) external onlyOwner {
        require(periodStart < periodEnd, "bad period");
        bytes32 periodKey = keccak256(abi.encodePacked(periodStart, periodEnd));
        require(!published[periodKey], "already published");
        published[periodKey] = true;
        emit Anchored(merkleRoot, periodStart, periodEnd, periodKey, anchorId);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
