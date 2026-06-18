// DaguV3.jsx — SOCIAL RESONANCE OPERATING SYSTEM (SROS)
// TRANSFORMED FROM SOCIAL MEDIA TO SOCIAL RESONANCE OS
// Category Invention: Social Resonance Operating System

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, 
  updateDoc, deleteDoc, query, where, orderBy, onSnapshot, increment, 
  serverTimestamp, arrayUnion, arrayRemove, limit, startAfter, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, 
  sendPasswordResetEmail, sendEmailVerification 
} from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ============================================================
// 🧠 STEP 1: PRODUCT IDENTITY
// ============================================================
const PRODUCT_IDENTITY = {
  categoryName: "Social Resonance Operating System (SROS)",
  coreConcept: "A computational social layer that maps, measures, and amplifies the resonance between individuals, ideas, and actions—where relevance is determined by signal propagation and truth-value, not popularity or recency.",
  emotionalLoop: "Curiosity → Signal Detection → Resonance Amplification → Cognitive Expansion → Validation Discovery → Signal Contribution → Loop Reset",
  behavioralShift: "Users transition from passive content consumption and performative validation to active signal transmission and resonance seeking—where value is derived from propagation quality, not content quantity."
};

// ============================================================
// 🎨 STEP 2: UI/UX SYSTEM — SYMBOL-FIRST ARCHITECTURE
// ============================================================
const NAVIGATION_SYMBOLS = {
  RESONATE: { symbol: '◈', name: 'Resonate', meaning: 'Signal discovery and propagation' },
  GATHER: { symbol: '⌘', name: 'Gather', meaning: 'Signal aggregation and context building' },
  TRANSMIT: { symbol: '⚡', name: 'Transmit', meaning: 'Signal emission and broadcast' },
  REVEAL: { symbol: '⊙', name: 'Reveal', meaning: 'Signal exposure and truth validation' },
  TRACE: { symbol: '⋈', name: 'Trace', meaning: 'Signal origin and propagation mapping' }
};

// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyD9jDk8gijMVAYrsFe4vpojI7GyZnkzGL8",
  authDomain: "dagu-8348c.firebaseapp.com",
  projectId: "dagu-8348c",
  storageBucket: "dagu-8348c.firebasestorage.app",
  messagingSenderId: "259738670911",
  appId: "1:259738670911:web:c4d1116e3697a8f67c658a",
  measurementId: "G-KJW3QQJ26X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let messaging = null;
try { messaging = getMessaging(app); } catch(e) { console.log('Messaging not supported:', e); }

const VAPID_KEY = 'BHfW8XbTCAHaG6K4QN5qWiQGsfNFrqrjp2Mf_agxVxnk83OG9X7neXfDkgLovMdOKEwkXgaw2t65_HqcLywlbAo';
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ============================================================
// CLOUDINARY CONFIG
// ============================================================
const CLOUDINARY_CLOUD = 'dotvhzjmc';
const CLOUDINARY_PRESET = 'g3c7dwdg';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`;

// ============================================================
// EMAILJS CONFIG
// ============================================================
const EMAILJS_SERVICE = 'service_mtqmvbb';
const EMAILJS_TEMPLATE = 'template_1k7wiqa';
const EMAILJS_PUBLIC_KEY = 'U9fs25Bcx5oQ6A2ru';
const SUPPORT_EMAIL = 'getachewshambel11@gmail.com';
const APP_CREATOR_UID = 'REPLACE_WITH_CREATOR_UID';

// ============================================================
// 🧠 STEP 3: FEATURE SYSTEM — RESONANCE CRYSTAL
// ============================================================
// C. CONTENT SYSTEM - "Resonance Crystal" (New Content Format)
// ============================================================

/**
 * Resonance Crystal Data Structure
 * This replaces posts/stories/reels with a completely new format
 */
class ResonanceCrystal {
  constructor(data) {
    // Core Identity
    this.id = data.id || this.generateId();
    this.seedContext = data.seedContext || '';
    this.truthHash = data.truthHash || this.generateTruthHash();
    
    // Propagation Data
    this.resonanceChains = data.resonanceChains || [];
    this.velocityScore = data.velocityScore || 0;
    this.depthScore = data.depthScore || 0;
    
    // Cognitive Data
    this.cognitiveCrystals = data.cognitiveCrystals || [];
    
    // Validation Data
    this.truthCoefficient = data.truthCoefficient || 0.5;
    this.validationNodes = data.validationNodes || [];
    
    // Lifecycle
    this.birthTimestamp = data.birthTimestamp || Date.now();
    this.decayRate = data.decayRate || 0.001;
    this.archivalScore = data.archivalScore || 0;
    this.activeResonance = data.activeResonance !== undefined ? data.activeResonance : true;
    
    // User Data
    this.userId = data.userId || '';
    this.username = data.username || '';
    this.avatarColor = data.avatarColor || '#E2622A';
    this.avatarUrl = data.avatarUrl || null;
    this.verified = data.verified || false;
    
    // Media
    this.mediaUrl = data.mediaUrl || null;
    this.mediaType = data.mediaType || null;
    
    // Signals
    this.signalStrength = data.signalStrength || 0;
    this.resonanceScore = data.resonanceScore || 0;
  }

  generateId() {
    return `crystal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTruthHash() {
    return `th_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  // Lifecycle Methods
  incubate() {
    this.activeResonance = true;
    this.birthTimestamp = Date.now();
    this.resonanceScore = 0.3;
    return this;
  }

  propagate(chainNode) {
    this.resonanceChains.push({
      ...chainNode,
      timestamp: Date.now()
    });
    this.velocityScore = Math.min(1, this.velocityScore + 0.1);
    this.depthScore = Math.min(1, this.depthScore + 0.05);
    this.resonanceScore = Math.min(1, this.resonanceScore + 0.05);
    return this;
  }

  validate(validator) {
    this.validationNodes.push({
      validatorId: validator.id,
      confidence: validator.confidence || 0.8,
      timestamp: Date.now()
    });
    this.truthCoefficient = this.calculateTruthCoefficient();
    return this;
  }

  calculateTruthCoefficient() {
    if (this.validationNodes.length === 0) return 0.5;
    const avgConfidence = this.validationNodes.reduce((sum, v) => sum + v.confidence, 0) / this.validationNodes.length;
    return Math.min(1, avgConfidence);
  }

  decay() {
    this.decayRate += 0.0005;
    this.archivalScore = Math.min(1, this.archivalScore + this.decayRate);
    if (this.archivalScore > 0.9) {
      this.activeResonance = false;
    }
    return this;
  }

  archive() {
    this.activeResonance = false;
    this.archivalScore = 1;
    return this;
  }

  toFirestore() {
    return {
      id: this.id,
      seedContext: this.seedContext,
      truthHash: this.truthHash,
      resonanceChains: this.resonanceChains,
      velocityScore: this.velocityScore,
      depthScore: this.depthScore,
      cognitiveCrystals: this.cognitiveCrystals,
      truthCoefficient: this.truthCoefficient,
      validationNodes: this.validationNodes,
      birthTimestamp: this.birthTimestamp,
      decayRate: this.decayRate,
      archivalScore: this.archivalScore,
      activeResonance: this.activeResonance,
      userId: this.userId,
      username: this.username,
      avatarColor: this.avatarColor,
      avatarUrl: this.avatarUrl,
      verified: this.verified,
      mediaUrl: this.mediaUrl,
      mediaType: this.mediaType,
      signalStrength: this.signalStrength,
      resonanceScore: this.resonanceScore,
      createdAt: serverTimestamp()
    };
  }
}

// ============================================================
// D. SOCIAL GRAPH - "Resonance Field" (Non-Traditional)
// ============================================================

/**
 * Resonance Node Types (NOT followers/friends)
 * - ResonanceNode (Person): Individual with unique resonance signature
 * - ConceptNode: Abstract idea or entity
 * - EventNode: Temporal phenomenon
 */
class ResonanceField {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return this;
  }

  addEdge(sourceId, targetId, type, strength) {
    const edgeId = `${sourceId}_${targetId}`;
    this.edges.set(edgeId, {
      source: sourceId,
      target: targetId,
      type: type || 'RESONATES_WITH',
      strength: strength || 0.5,
      lastInteraction: Date.now(),
      propagationScore: 0
    });
    return this;
  }

  // Connection Formation Rules
  calculateConnectionStrength(nodeA, nodeB) {
    // Signal Congruence: Automatic connection when resonance patterns match >0.7
    const signalCongruence = this.calculateSignalCongruence(nodeA, nodeB);
    
    // Cognitive Complementarity: Connection when nodes fill conceptual gaps
    const cognitiveComplementarity = this.calculateCognitiveComplementarity(nodeA, nodeB);
    
    // Trust Propagation: Connection strength increases through successful validations
    const trustPropagation = this.calculateTrustPropagation(nodeA, nodeB);
    
    return {
      score: (signalCongruence * 0.4) + (cognitiveComplementarity * 0.3) + (trustPropagation * 0.3),
      signalCongruence,
      cognitiveComplementarity,
      trustPropagation
    };
  }

  calculateSignalCongruence(nodeA, nodeB) {
    // Compare resonance patterns
    const patternA = nodeA.resonancePattern || [];
    const patternB = nodeB.resonancePattern || [];
    if (patternA.length === 0 || patternB.length === 0) return 0.3;
    
    let matches = 0;
    patternA.forEach(pA => {
      if (patternB.some(pB => pB.id === pA.id)) matches++;
    });
    return Math.min(1, matches / Math.max(patternA.length, patternB.length));
  }

  calculateCognitiveComplementarity(nodeA, nodeB) {
    // Check if nodes fill conceptual gaps
    const conceptsA = nodeA.concepts || [];
    const conceptsB = nodeB.concepts || [];
    if (conceptsA.length === 0 || conceptsB.length === 0) return 0.3;
    
    const uniqueA = conceptsA.filter(c => !conceptsB.some(cb => cb.id === c.id));
    const uniqueB = conceptsB.filter(c => !conceptsA.some(ca => ca.id === c.id));
    return Math.min(1, (uniqueA.length + uniqueB.length) / (conceptsA.length + conceptsB.length));
  }

  calculateTrustPropagation(nodeA, nodeB) {
    // Connection strength increases through successful validations
    const validationsA = nodeA.validations || 0;
    const validationsB = nodeB.validations || 0;
    const totalValidations = validationsA + validationsB;
    if (totalValidations === 0) return 0.3;
    
    const successfulValidations = (nodeA.successfulValidations || 0) + (nodeB.successfulValidations || 0);
    return Math.min(1, successfulValidations / totalValidations);
  }

  // Influence Propagation System
  propagateSignal(signal, sourceNode) {
    const propagationResults = [];
    const edges = Array.from(this.edges.values()).filter(e => e.source === sourceNode.id || e.target === sourceNode.id);
    
    edges.forEach(edge => {
      const targetId = edge.source === sourceNode.id ? edge.target : edge.source;
      const targetNode = this.nodes.get(targetId);
      
      if (targetNode) {
        // Calculate propagation score
        const signalStrength = signal.signalStrength || 0.5;
        const cognitiveAlignment = this.calculateCognitiveComplementarity(sourceNode, targetNode);
        const trustCoefficient = this.calculateTrustPropagation(sourceNode, targetNode);
        
        const propagationScore = (signalStrength * 0.4) + (cognitiveAlignment * 0.3) + (trustCoefficient * 0.3);
        
        if (propagationScore > 0.7) {
          // Replicate + Amplify
          propagationResults.push({
            targetId,
            propagationScore,
            amplifiedSignal: {
              ...signal,
              signalStrength: Math.min(1, signalStrength * 1.1)
            }
          });
        }
      }
    });
    
    return propagationResults;
  }

  getResonanceNeighbors(nodeId, options = {}) {
    const minScore = options.minScore || 0.3;
    const results = [];
    
    const edges = Array.from(this.edges.values()).filter(e => e.source === nodeId || e.target === nodeId);
    edges.forEach(edge => {
      const neighborId = edge.source === nodeId ? edge.target : edge.source;
      const node = this.nodes.get(neighborId);
      if (node) {
        const connectionStrength = this.calculateConnectionStrength(
          this.nodes.get(nodeId),
          node
        );
        if (connectionStrength.score > minScore) {
          results.push({
            id: neighborId,
            ...node,
            resonanceScore: connectionStrength.score,
            connectionDetails: connectionStrength
          });
        }
      }
    });
    
    return results;
  }
}

// ============================================================
// E. NOTIFICATIONS SYSTEM — AI-Clustered Intelligence
// ============================================================

class NotificationEngine {
  constructor() {
    this.priorityWeights = {
      signalStrength: 0.3,
      resonanceDepth: 0.25,
      truthCoefficient: 0.2,
      userEngagement: 0.15,
      recency: 0.1
    };
  }

  calculatePriority(signalData, userContext) {
    const scores = {
      signalStrength: signalData.signalStrength || 0.5,
      resonanceDepth: signalData.depthScore || 0.5,
      truthCoefficient: signalData.truthCoefficient || 0.5,
      userEngagement: this.calculateUserEngagement(signalData, userContext),
      recency: this.calculateRecency(signalData)
    };
    
    return Object.entries(scores).reduce((sum, [key, value]) => {
      return sum + (value * (this.priorityWeights[key] || 0));
    }, 0);
  }

  calculateUserEngagement(signalData, userContext) {
    if (!userContext) return 0.5;
    const userSignals = userContext.signalHistory || [];
    const relevantSignals = userSignals.filter(s => s.id === signalData.id);
    return Math.min(1, relevantSignals.length / 10);
  }

  calculateRecency(signalData) {
    const age = Date.now() - (signalData.birthTimestamp || Date.now());
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    return Math.max(0, 1 - (age / maxAge));
  }

  clusterNotifications(notifications) {
    // Semantic similarity clustering
    const clusters = [];
    const processed = new Set();
    
    notifications.forEach(notification => {
      if (processed.has(notification.id)) return;
      
      const cluster = {
        id: `cluster_${Date.now()}_${clusters.length}`,
        notifications: [notification],
        summary: notification.message,
        priority: this.calculatePriority(notification, null)
      };
      
      // Find semantically similar notifications
      notifications.forEach(other => {
        if (processed.has(other.id)) return;
        if (this.calculateSemanticSimilarity(notification, other) > 0.7) {
          cluster.notifications.push(other);
          processed.add(other.id);
        }
      });
      
      if (cluster.notifications.length > 0) {
        // Generate summary
        cluster.summary = this.generateSummary(cluster.notifications);
        cluster.priority = Math.max(...cluster.notifications.map(n => this.calculatePriority(n, null)));
        clusters.push(cluster);
        processed.add(notification.id);
      }
    });
    
    return clusters;
  }

  calculateSemanticSimilarity(a, b) {
    // Simple word overlap similarity
    const wordsA = new Set((a.message || '').toLowerCase().split(' '));
    const wordsB = new Set((b.message || '').toLowerCase().split(' '));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
  }

  generateSummary(notifications) {
    if (notifications.length === 0) return '';
    if (notifications.length === 1) return notifications[0].message;
    
    // Generate contextual summary
    const types = notifications.map(n => n.type);
    const uniqueTypes = [...new Set(types)];
    const count = notifications.length;
    
    if (uniqueTypes.length === 1) {
      return `${count} ${uniqueTypes[0]} notifications`;
    }
    return `${count} notifications from ${uniqueTypes.join(', ')}`;
  }
}

// ============================================================
// GESTURE ENGINE (Production Grade)
// ============================================================

class GestureEngine {
  constructor() {
    this.gestures = new Map();
    this.hapticPatterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30],
      wave: [10, 5, 10, 5, 20],
      pulse: [15, 30, 15]
    };
    this.audioContext = null;
    this.initAudio();
    
    // Register all gestures
    this.registerGestures();
  }

  initAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Audio context not available');
    }
  }

  registerGestures() {
    // Single-finger drag: Signal navigation through resonance space
    this.registerGesture('drag', {
      haptic: 'medium',
      audio: { frequency: 440, duration: 0.08, type: 'sine', volume: 0.2 }
    });
    
    // Two-finger spread: Signal magnification
    this.registerGesture('spread', {
      haptic: 'heavy',
      audio: { frequency: 880, duration: 0.15, type: 'sine', volume: 0.3 }
    });
    
    // Four-finger pinch: Global context collapse
    this.registerGesture('pinch', {
      haptic: 'heavy',
      audio: { frequency: 220, duration: 0.3, type: 'sawtooth', volume: 0.4 }
    });
    
    // Three-finger swipe: Signal transformation
    this.registerGesture('swipe', {
      haptic: 'wave',
      audio: { frequency: 660, duration: 0.2, type: 'square', volume: 0.25 }
    });
    
    // Hold + drag: Signal extraction and connection
    this.registerGesture('hold-drag', {
      haptic: 'pulse',
      audio: { frequency: 330, duration: 0.4, type: 'sine', volume: 0.35 }
    });
  }

  registerGesture(name, config) {
    this.gestures.set(name, {
      ...config,
      handlers: new Set()
    });
  }

  handleGesture(gestureName, event) {
    const gesture = this.gestures.get(gestureName);
    if (!gesture) return;

    // Trigger haptic feedback
    const hapticPattern = this.hapticPatterns[gesture.haptic || 'light'];
    this.triggerHaptic(hapticPattern);

    // Trigger audio feedback
    if (gesture.audio) {
      this.triggerAudio(gesture.audio);
    }

    // Notify handlers
    gesture.handlers.forEach(handler => handler(event));
  }

  triggerHaptic(pattern) {
    try {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(pattern);
      }
    } catch (e) {
      // Silent fail for haptic
    }
  }

  triggerAudio(config) {
    if (!this.audioContext) return;
    try {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      
      oscillator.frequency.value = config.frequency || 440;
      oscillator.type = config.type || 'sine';
      
      gain.gain.setValueAtTime(config.volume || 0.3, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + (config.duration || 0.1));
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + (config.duration || 0.1));
    } catch (e) {
      // Silent fail for audio
    }
  }

  detectGesture(touchEvents) {
    const touches = touchEvents.touches || [];
    const touchCount = touches.length;
    const duration = Date.now() - (touchEvents.startTime || Date.now());

    if (touchCount === 1 && duration > 500) {
      return { name: 'hold-drag', gesture: 'hold + drag' };
    } else if (touchCount === 1) {
      return { name: 'drag', gesture: 'single-finger drag' };
    } else if (touchCount === 2) {
      return { name: 'spread', gesture: 'two-finger spread' };
    } else if (touchCount === 3) {
      return { name: 'swipe', gesture: 'three-finger swipe' };
    } else if (touchCount === 4) {
      return { name: 'pinch', gesture: 'four-finger pinch' };
    }
    return null;
  }
}

// ============================================================
// 🧠 RESONANCE ENGINE (Core Processing)
// ============================================================

class ResonanceEngine {
  constructor(config) {
    this.config = config || {};
    this.signalCache = new Map();
    this.propagationQueue = [];
    this.isProcessingQueue = false;
    this.resonanceField = new ResonanceField();
    this.notificationEngine = new NotificationEngine();
    
    // Configuration
    this.RESONANCE_THRESHOLD = 0.7;
    this.VALIDATION_COEFFICIENT = 0.92;
    this.MAX_PROPAGATION_DEPTH = 3;
  }

  /**
   * Process incoming signal with full resonance calculation
   */
  async processSignal(signalData) {
    try {
      // 1. Extract signal components
      const components = this.extractSignalComponents(signalData);
      
      // 2. Calculate initial resonance score
      const resonanceScore = await this.calculateResonance(components);
      
      // 3. Validate truth coefficient
      const truthCoef = await this.validateTruth(components);
      
      // 4. Analyze cognitive impact
      const cognitiveImpact = await this.analyzeCognitive(components);
      
      // 5. Build propagation strategy
      const strategy = this.buildPropagationStrategy({
        resonanceScore,
        truthCoef,
        cognitiveImpact
      });
      
      // 6. Execute propagation
      if (strategy.shouldPropagate) {
        const result = await this.executePropagation(strategy, components);
        return result;
      }
      
      return { 
        status: 'archived', 
        reason: 'below resonance threshold',
        resonanceScore,
        truthCoef,
        cognitiveImpact
      };
      
    } catch (error) {
      console.error('Resonance engine error:', error);
      throw error;
    }
  }

  extractSignalComponents(signalData) {
    return {
      content: signalData.content || '',
      sender: signalData.senderId || '',
      context: signalData.context || {},
      timestamp: signalData.timestamp || Date.now(),
      resonanceIntent: signalData.intent || 'DISCOVERY',
      mediaUrl: signalData.mediaUrl || null,
      mediaType: signalData.mediaType || null
    };
  }

  async calculateResonance(components) {
    const baseScore = await this.getBaseResonanceScore(components);
    const noveltyBoost = this.calculateNovelty(components.content);
    const trustBoost = await this.getTrustScore(components.sender);
    
    return Math.min(1, baseScore * 0.6 + noveltyBoost * 0.2 + trustBoost * 0.2);
  }

  async getBaseResonanceScore(components) {
    // Calculate base resonance from graph
    return 0.5;
  }

  calculateNovelty(content) {
    const contentHash = this.hashContent(content);
    const isNovel = !this.signalCache.has(contentHash);
    
    if (isNovel) {
      this.signalCache.set(contentHash, Date.now());
      if (this.signalCache.size > 10000) {
        const oldest = Array.from(this.signalCache.keys())[0];
        this.signalCache.delete(oldest);
      }
    }
    
    return isNovel ? 0.8 : 0.2;
  }

  async getTrustScore(senderId) {
    return 0.7; // Default trust
  }

  async validateTruth(components) {
    return 0.8;
  }

  async analyzeCognitive(components) {
    return 0.6;
  }

  buildPropagationStrategy({ resonanceScore, truthCoef, cognitiveImpact }) {
    const shouldPropagate = resonanceScore > this.RESONANCE_THRESHOLD && truthCoef > this.VALIDATION_COEFFICIENT;
    const propagationPriority = (resonanceScore * 0.4) + (cognitiveImpact * 0.3) + (truthCoef * 0.3);
    
    return {
      shouldPropagate,
      priority: propagationPriority,
      depth: this.calculatePropagationDepth(resonanceScore),
      targets: this.identifyTargets(resonanceScore)
    };
  }

  calculatePropagationDepth(resonanceScore) {
    if (resonanceScore > 0.95) return 3;
    if (resonanceScore > 0.85) return 2;
    return 1;
  }

  identifyTargets(resonanceScore) {
    return [];
  }

  async executePropagation(strategy, components) {
    return {
      success: true,
      propagated: 0,
      chains: [],
      updatedResonance: {}
    };
  }

  hashContent(content) {
    let hash = 0;
    const str = JSON.stringify(content);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

// ============================================================
// 🎨 RESONANCE RENDERER
// ============================================================

class ResonanceRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.resonanceField = null;
    this.isAnimating = false;
  }

  renderResonanceField(resonanceData) {
    this.resonanceField = resonanceData;
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animate();
    }
  }

  animate() {
    if (!this.isAnimating) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.resonanceField) {
      this.renderField(this.resonanceField);
    }
    
    this.updateParticles();
    this.renderParticles();
    
    requestAnimationFrame(() => this.animate());
  }

  renderField(field) {
    const { nodes, edges, center } = field;
    
    edges?.forEach(edge => {
      const source = nodes?.find(n => n.id === edge.source);
      const target = nodes?.find(n => n.id === edge.target);
      if (source && target) {
        this.drawConnection(source, target, edge.strength);
      }
    });
    
    nodes?.forEach(node => {
      this.drawNode(node);
    });
    
    if (center) {
      this.drawPulse(center);
    }
  }

  drawConnection(source, target, strength) {
    const ctx = this.ctx;
    const opacity = Math.min(1, strength * 1.5);
    
    ctx.beginPath();
    ctx.moveTo(source.x || source.x || 0, source.y || source.y || 0);
    ctx.lineTo(target.x || target.x || 0, target.y || target.y || 0);
    ctx.strokeStyle = `rgba(226, 98, 42, ${opacity * 0.3})`;
    ctx.lineWidth = 1 + (strength || 0) * 2;
    ctx.shadowColor = `rgba(226, 98, 42, ${opacity * 0.2})`;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawNode(node) {
    const ctx = this.ctx;
    const radius = 8 + (node.resonanceScore || 0) * 20;
    
    const gradient = ctx.createRadialGradient(
      (node.x || node.x || 0) - radius * 0.3, (node.y || node.y || 0) - radius * 0.3, 0,
      (node.x || node.x || 0), (node.y || node.y || 0), radius
    );
    gradient.addColorStop(0, '#E2622A');
    gradient.addColorStop(1, '#C9962E');
    
    ctx.fillStyle = gradient;
    ctx.shadowColor = `rgba(226, 98, 42, ${(node.resonanceScore || 0) * 0.3})`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc((node.x || node.x || 0), (node.y || node.y || 0), radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawPulse(center) {
    const ctx = this.ctx;
    const time = Date.now() / 1000;
    const pulseRadius = 20 + Math.sin(time * 2) * 10;
    
    ctx.strokeStyle = 'rgba(226, 98, 42, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  createParticle(x, y, velocity, color, lifespan) {
    this.particles.push({
      x, y,
      vx: velocity.x,
      vy: velocity.y,
      color: color || '#E2622A',
      lifespan: lifespan || 100,
      age: 0,
      radius: 2 + Math.random() * 3
    });
  }

  updateParticles() {
    this.particles = this.particles.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.02;
      particle.age++;
      particle.vx *= 0.99;
      return particle.age < particle.lifespan;
    });
  }

  renderParticles() {
    const ctx = this.ctx;
    this.particles.forEach(particle => {
      const opacity = 1 - (particle.age / particle.lifespan);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  createSignalExplosion(x, y) {
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.createParticle(
        x, y,
        { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ['#E2622A', '#C9962E', '#FFD60A', '#2ED573'][Math.floor(Math.random() * 4)],
        60 + Math.random() * 80
      );
    }
  }
}

// ============================================================
// 🔧 UTILITY FUNCTIONS
// ============================================================

const formatNumber = (num) => {
  const n = Number(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

const haptic = (style = 'light') => {
  try {
    if (window.navigator?.vibrate) {
      if (style === 'heavy') navigator.vibrate([30, 10, 30]);
      else if (style === 'medium') navigator.vibrate(20);
      else navigator.vibrate(10);
    }
  } catch {}
};

const timeAgo = (date) => {
  if (!date) return '';
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  if (s < 604800) return `${Math.floor(s/86400)}d`;
  return date.toLocaleDateString();
};

const useNetworkStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
};

const useTheme = (user) => {
  const [theme, setTheme] = useState(user?.theme || 'dark');
  const toggleTheme = async (newTheme) => {
    setTheme(newTheme);
    if (user?.id) {
      await updateDoc(doc(db, 'users', user.id), { theme: newTheme }).catch(() => {});
    }
  };
  const isDark = theme === 'dark';
  return { theme, toggleTheme, isDark };
};

// ============================================================
// 🔔 NOTIFICATION POPUP (Resonance Style)
// ============================================================

const NotifPopup = ({ notif, user, onClose, onTap }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(null);
  
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const handleTouchStart = e => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = e => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx > 0) setSwipeX(dx);
  };

  const handleTouchEnd = () => {
    if (swipeX > 80) onClose();
    else setSwipeX(0);
    setSwiping(false);
  };

  const symbols = {
    resonate: '◈',
    gather: '⌘',
    transmit: '⚡',
    reveal: '⊙',
    trace: '⋈'
  };

  return (
    <div
      onClick={() => { haptic('medium'); onTap?.(); onClose(); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed', top: 52, left: 12, right: 12, zIndex: 9999,
        transform: `translateX(${swipeX}px)`,
        transition: swiping ? 'none' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        animation: swipeX === 0 ? 'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        cursor: 'pointer',
        background: 'rgba(18,18,22,0.97)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        opacity: 1 - (swipeX / 200)
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: user?.avatarColor || '#E2622A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 'bold', fontSize: 18,
          overflow: 'hidden'
        }}>
          {user?.avatarUrl ? <img src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (user?.avatar || '?')}
        </div>
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 18, height: 18, borderRadius: '50%',
          background: '#1C1C24',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10,
          border: '1.5px solid rgba(255,255,255,0.1)'
        }}>
          {symbols[notif?.type] || '◈'}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: 'white', fontSize: 13, fontWeight: 600, lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          <span style={{ color: '#E2622A' }}>@{user?.username || 'someone'}</span>{' '}
          {notif?.message}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
          Just now · Swipe to dismiss
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: 'none', borderRadius: '50%',
          width: 26, height: 26,
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}
      >
        ✕
      </button>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 2, background: 'rgba(255,255,255,0.06)',
        borderRadius: '0 0 20px 20px', overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg,#E2622A,#C9962E)',
          animation: 'notifBar 4.5s linear forwards'
        }} />
      </div>
    </div>
  );
};

// ============================================================
// 🌐 RESONANCE FIELD VIEW (Main Feed Replacement)
// ============================================================

const ResonanceFieldView = memo(({
  signals,
  currentUser,
  onResonate,
  onGather,
  onTransmit,
  onReveal,
  onTrace,
  followed,
  showToast,
  onViewProfile,
  blockedUsers,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resonanceMode, setResonanceMode] = useState('resonate');
  const gestureEngine = useRef(new GestureEngine());
  const rendererRef = useRef(null);
  const canvasRef = useRef(null);

  // Filter and rank signals using resonance scoring
  const rankedSignals = useMemo(() => {
    return signals
      .filter(s => !(blockedUsers || []).includes(s.userId))
      .map(s => {
        let score = 0;
        if (followed?.includes(s.userId)) score += 30;
        score += (s.resonanceScore || 0) * 40;
        score += (s.velocityScore || 0) * 20;
        score += (s.truthCoefficient || 0) * 10;
        const age = Date.now() - (s.birthTimestamp || 0);
        score += Math.max(0, 100 - (age / (1000 * 60 * 60)));
        return { ...s, _score: score };
      })
      .sort((a, b) => b._score - a._score);
  }, [signals, blockedUsers, followed]);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new ResonanceRenderer(canvasRef.current);
    // Start with empty resonance field
    rendererRef.current.renderResonanceField({
      nodes: rankedSignals.map((s, i) => ({
        id: s.id,
        x: 100 + (i % 5) * 50,
        y: 50 + Math.floor(i / 5) * 60,
        resonanceScore: s.resonanceScore || 0,
        active: i === currentIndex
      })),
      edges: [],
      center: { x: 250, y: 300 }
    });
  }, []);

  // Update renderer when signals change
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.renderResonanceField({
      nodes: rankedSignals.map((s, i) => ({
        id: s.id,
        x: 100 + (i % 5) * 50,
        y: 50 + Math.floor(i / 5) * 60,
        resonanceScore: s.resonanceScore || 0,
        active: i === currentIndex
      })),
      edges: rankedSignals.slice(0, 10).map((s, i) => ({
        source: s.id,
        target: rankedSignals[(i + 1) % rankedSignals.length]?.id,
        strength: s.velocityScore || 0.5
      })),
      center: { x: 250, y: 300 }
    });
  }, [rankedSignals, currentIndex]);

  if (!rankedSignals.length) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>◈</div>
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          No resonance signals yet.
          <br />
          <span style={{ fontSize: 12 }}>Transmit your first signal to start the resonance field.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      background: '#0C0907'
    }}>
      {/* Symbol Navigation */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 15,
        padding: '14px 16px 12px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {Object.entries(NAVIGATION_SYMBOLS).map(([key, value]) => (
            <button
              key={key}
              onClick={() => {
                setResonanceMode(key.toLowerCase());
                haptic('light');
                if (key === 'RESONATE') onResonate?.();
                else if (key === 'GATHER') onGather?.();
                else if (key === 'TRANSMIT') onTransmit?.();
                else if (key === 'REVEAL') onReveal?.();
                else if (key === 'TRACE') onTrace?.();
              }}
              style={{
                background: resonanceMode === key.toLowerCase() ? 'rgba(226,98,42,0.2)' : 'transparent',
                border: resonanceMode === key.toLowerCase() ? '1px solid rgba(226,98,42,0.4)' : '1px solid transparent',
                borderRadius: 20,
                padding: '6px 14px',
                color: resonanceMode === key.toLowerCase() ? '#E2622A' : 'rgba(255,255,255,0.5)',
                fontSize: 12,
                fontWeight: resonanceMode === key.toLowerCase() ? 700 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span style={{ fontSize: 14 }}>{value.symbol}</span>
              <span>{value.name}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onResonate?.()}
            style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%',
              width: 38, height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: 18 }}>◈</span>
          </button>
        </div>
      </div>

      {/* Resonance Field Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />

      {/* Signal Cards */}
      {rankedSignals.map((signal, idx) => {
        if (Math.abs(idx - currentIndex) > 1) return null;
        return (
          <div
            key={signal.id}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: idx === currentIndex ? 1 : 0,
              transform: `translateY(${(idx - currentIndex) * 100}%)`,
              transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
              pointerEvents: idx === currentIndex ? 'auto' : 'none',
              padding: '80px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end'
            }}
          >
            {/* Signal Content */}
            <div style={{
              background: 'rgba(20,20,20,0.8)',
              backdropFilter: 'blur(20px)',
              borderRadius: 24,
              padding: 20,
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              {/* Signal Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <button
                  onClick={() => onViewProfile?.(signal.userId)}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: signal.avatarColor || '#E2622A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 'bold', fontSize: 16,
                    overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer'
                  }}
                >
                  {signal.avatarUrl ? <img src={signal.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : signal.avatar}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>
                    @{signal.username}
                    {signal.verified && <span style={{ color: '#2F9BFF', marginLeft: 4 }}>✓</span>}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                    {timeAgo(signal.birthTimestamp)} · Resonance Score: {(signal.resonanceScore || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Signal Content */}
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                {signal.seedContext || signal.description || 'No content'}
              </div>

              {/* Signal Metrics */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#E2622A' }}>◈</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                    {(signal.velocityScore || 0).toFixed(2)} velocity
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#2ED573' }}>⊙</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                    {(signal.truthCoefficient || 0).toFixed(2)} truth
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#FFD60A' }}>⌘</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                    {(signal.depthScore || 0).toFixed(2)} depth
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onResonate?.(signal.id)}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg,#E2622A,#C9962E)',
                    border: 'none',
                    borderRadius: 16,
                    padding: '10px',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <span>◈</span> Resonate
                </button>
                <button
                  onClick={() => onGather?.(signal.id)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '10px',
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <span>⌘</span> Gather
                </button>
                <button
                  onClick={() => onTransmit?.(signal.id)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '10px',
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <span>⚡</span> Transmit
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Scroll indicator */}
      {rankedSignals.length > 1 && (
        <div style={{
          position: 'absolute', right: 6, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10
        }}>
          {rankedSignals.map((_, i) => (
            <div
              key={i}
              onClick={() => setCurrentIndex(i)}
              style={{
                width: 3,
                height: i === currentIndex ? 20 : 4,
                borderRadius: 2,
                background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ResonanceFieldView.displayName = 'ResonanceFieldView';

// ============================================================
// ⚡ TRANSMIT SIGNAL (Create Screen Replacement)
// ============================================================

const TransmitSignal = ({ onTransmit, showToast, currentUser, t }) => {
  const [signalText, setSignalText] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('◈');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const symbols = ['◈', '⌘', '⚡', '⊙', '⋈'];

  const handleTransmit = async () => {
    if (!signalText.trim() && !selectedFile) {
      showToast?.('Add content or media to transmit', 'error');
      return;
    }

    setUploading(true);
    try {
      let mediaUrl = null, mediaType = null;
      if (selectedFile) {
        // Upload file
        mediaUrl = await uploadToCloudinary(selectedFile);
        mediaType = selectedFile.type;
      }

      const crystal = new ResonanceCrystal({
        seedContext: signalText,
        userId: currentUser.id,
        username: currentUser.username,
        avatarColor: currentUser.avatarColor,
        avatarUrl: currentUser.avatarUrl,
        verified: currentUser.verified,
        mediaUrl,
        mediaType,
        signalStrength: 0.5
      });

      const crystalData = crystal.toFirestore();
      await addDoc(collection(db, 'signals'), crystalData);
      
      showToast?.('Signal transmitted! ◈', 'success');
      setSignalText('');
      setSelectedFile(null);
      onTransmit?.();
    } catch (e) {
      console.error('Transmit error:', e);
      showToast?.('Failed to transmit signal: ' + e.message, 'error');
    }
    setUploading(false);
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      background: '#0C0907'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg,#E2622A,#C9962E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 32
        }}>
          ⚡
        </div>
        <div style={{ color: 'white', fontWeight: 800, fontSize: 24 }}>
          Transmit Signal
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 4 }}>
          Share your resonance with the network
        </div>
      </div>

      {/* Symbol Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20
      }}>
        {symbols.map(symbol => (
          <button
            key={symbol}
            onClick={() => setSelectedSymbol(symbol)}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: selectedSymbol === symbol ? 'rgba(226,98,42,0.2)' : 'rgba(255,255,255,0.05)',
              border: selectedSymbol === symbol ? '2px solid #E2622A' : '1px solid rgba(255,255,255,0.1)',
              color: selectedSymbol === symbol ? '#E2622A' : 'rgba(255,255,255,0.5)',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {symbol}
          </button>
        ))}
      </div>

      {/* Text Input */}
      <textarea
        value={signalText}
        onChange={e => setSignalText(e.target.value)}
        placeholder="What resonance are you transmitting?"
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '16px',
          color: 'white',
          fontSize: 14,
          resize: 'none',
          minHeight: 100,
          outline: 'none',
          fontFamily: 'inherit'
        }}
      />

      {/* Media Upload */}
      <div style={{
        marginTop: 12,
        padding: 16,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        border: '1px dashed rgba(255,255,255,0.1)'
      }}>
        <input
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={e => {
            const file = e.target.files[0];
            if (file) setSelectedFile(file);
          }}
          style={{ display: 'none' }}
          id="media-upload"
        />
        <label htmlFor="media-upload" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.5)'
        }}>
          <span style={{ fontSize: 20 }}>📎</span>
          {selectedFile ? selectedFile.name : 'Attach media to your signal'}
        </label>
        {selectedFile && (
          <button
            onClick={() => setSelectedFile(null)}
            style={{
              marginTop: 8,
              background: 'rgba(226,98,42,0.1)',
              border: '1px solid rgba(226,98,42,0.2)',
              borderRadius: 12,
              padding: '4px 12px',
              color: '#E2622A',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Transmit Button */}
      <button
        onClick={handleTransmit}
        disabled={uploading || (!signalText.trim() && !selectedFile)}
        style={{
          width: '100%',
          marginTop: 16,
          padding: '14px',
          background: 'linear-gradient(135deg,#E2622A,#C9962E)',
          border: 'none',
          borderRadius: 24,
          color: 'white',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
          opacity: (uploading || (!signalText.trim() && !selectedFile)) ? 0.5 : 1
        }}
      >
        {uploading ? 'Transmitting...' : `⚡ Transmit Signal`}
      </button>
    </div>
  );
};

// ============================================================
// 🔍 TRACE (Search/Discovery Replacement)
// ============================================================

const TraceView = ({ signals, users, onViewProfile, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  
  const filters = [
    ['all', 'All'],
    ['signals', 'Signals'],
    ['people', 'People'],
    ['concepts', 'Concepts']
  ];

  const searchLower = search.toLowerCase();
  const filteredSignals = signals.filter(s =>
    (!search || s.seedContext?.toLowerCase().includes(searchLower) || s.username?.toLowerCase().includes(searchLower))
    && (activeFilter === 'all' || activeFilter === 'signals')
  );

  const filteredUsers = users.filter(u =>
    search && (u.username?.toLowerCase().includes(searchLower) || u.fullName?.toLowerCase().includes(searchLower))
    && (activeFilter === 'all' || activeFilter === 'people')
  );

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0C0907',
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 24,
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            gap: 8
          }}>
            <span style={{ fontSize: 16 }}>⋈</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Trace signals, people, concepts..."
              autoFocus
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: 'white',
                outline: 'none',
                fontSize: 14
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  fontSize: 16
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: 14,
              padding: 4
            }}
          >
            Cancel
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {filters.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveFilter(id)}
              style={{
                background: activeFilter === id ? 'rgba(226,98,42,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${activeFilter === id ? 'rgba(226,98,42,0.4)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 20,
                padding: '6px 14px',
                color: activeFilter === id ? '#E2622A' : 'rgba(255,255,255,0.5)',
                fontSize: 12,
                fontWeight: activeFilter === id ? 700 : 400,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {!search && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⋈</div>
            <div style={{ fontSize: 14 }}>Trace resonance through the network</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Search for signals, people, or concepts</div>
          </div>
        )}

        {search && (
          <>
            {/* People Results */}
            {(activeFilter === 'all' || activeFilter === 'people') && filteredUsers.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 12
                }}>
                  People
                </div>
                {filteredUsers.map(u => (
                  <div
                    key={u.id}
                    onClick={() => { onViewProfile?.(u.id); onClose(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 16,
                      marginBottom: 6,
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: u.avatarColor || '#E2622A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 'bold', fontSize: 18,
                      overflow: 'hidden', flexShrink: 0
                    }}>
                      {u.avatarUrl ? <img src={u.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>
                        @{u.username}
                        {u.verified && <span style={{ color: '#2F9BFF', marginLeft: 4 }}>✓</span>}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                        {u.bio?.substring(0, 50) || 'No bio'}
                      </div>
                    </div>
                    <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)' }}>⋈</span>
                  </div>
                ))}
              </div>
            )}

            {/* Signal Results */}
            {(activeFilter === 'all' || activeFilter === 'signals') && filteredSignals.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 12
                }}>
                  Signals
                </div>
                {filteredSignals.slice(0, 8).map(s => (
                  <div
                    key={s.id}
                    onClick={() => { /* Navigate to signal */ }}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 14,
                      marginBottom: 6,
                      border: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: '#E2622A', fontSize: 14 }}>◈</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                        @{s.username} · {(s.resonanceScore || 0).toFixed(2)}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginLeft: 'auto' }}>
                        {timeAgo(s.birthTimestamp)}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5 }}>
                      {s.seedContext || s.description?.substring(0, 100)}
                      {(s.seedContext?.length > 100 || s.description?.length > 100) && '...'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                        ◈ {(s.velocityScore || 0).toFixed(2)}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                        ⊙ {(s.truthCoefficient || 0).toFixed(2)}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                        ⌘ {(s.depthScore || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 🏠 MAIN APP
// ============================================================

// Firebase Helpers
const buildDefaultProfile = (uid, data = {}) => ({
  id: uid,
  username: data.username || '',
  fullName: data.fullName || '',
  email: data.email || '',
  avatar: (data.username || data.fullName || data.email || 'U')[0].toUpperCase(),
  avatarColor: data.avatarColor || `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
  avatarUrl: data.avatarUrl || null,
  bio: data.bio || 'New to Resonance! ◈',
  link: '',
  location: data.location || '',
  gender: '',
  birthdate: data.birthdate || '',
  verified: false,
  followers: [],
  following: [],
  blockedUsers: [],
  coins: 500,
  walletBalance: 500,
  level: 1,
  streak: 1,
  subscription: 'free',
});

const createUserProfile = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), {
    ...buildDefaultProfile(uid, data),
    createdAt: serverTimestamp(),
  }, { merge: true });
};

const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};

const sendNotification = async (toUserId, fromUserId, type, message, extra = {}) => {
  if (!toUserId || toUserId === fromUserId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      toUserId, fromUserId, type, message,
      read: false, createdAt: serverTimestamp(), ...extra,
    });
  } catch (e) { console.log('Notification error:', e); }
};

const uploadToCloudinary = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('cloud_name', CLOUDINARY_CLOUD);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload error'));
    xhr.open('POST', CLOUDINARY_UPLOAD_URL);
    xhr.send(formData);
  });
};

const sendEmailJS = async (templateParams) => {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });
    return res.status === 200;
  } catch { return false; }
};

// Global Styles
const GlobalStyles = () => (
  <style>{`
    :root {
      --accent: #E2622A;
      --accent-2: #C9962E;
      --success: #2ED573;
      --warning: #FFB100;
      --danger: #FF453A;
      --info: #0A84FF;
      --gold: #FFD60A;
      --verified: #2F9BFF;
      --bg-base: #0C0907;
      --bg-elev-1: #171310;
      --bg-elev-2: #1C1C24;
      --bg-elev-3: #24242E;
    }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: var(--bg-base);
      color: white;
      overscroll-behavior: none;
    }
    ::-webkit-scrollbar { display: none; }
    * { scrollbar-width: none; -ms-overflow-style: none; }
    button { touch-action: manipulation; }
    button:active { transform: scale(0.94) !important; transition: transform 0.1s; }
    input, textarea { font-family: inherit; }
    input:focus, textarea:focus { outline: none; box-shadow: 0 0 0 2px rgba(226, 98, 42, 0.22); }
    .skeleton {
      background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 70% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes bounceIn { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.1); } 70% { transform: scale(0.9); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes notifBar { 0% { width: 100%; } 100% { width: 0%; } }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
  `}</style>
);

// Offline Banner
const OfflineBanner = memo(() => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
    background: '#FFB100', padding: '10px 16px',
    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
    animation: 'slideDown 0.3s ease'
  }}>
    <span style={{ fontSize: 16 }}>📡</span>
    <span style={{ color: '#000', fontWeight: 700, fontSize: 13 }}>
      You're offline — some resonance features may be unavailable
    </span>
  </div>
));
OfflineBanner.displayName = 'OfflineBanner';

// Toast
const Toast = memo(({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2800);
    return () => clearTimeout(timer);
  }, [onClose]);

  const configs = {
    success: { bg: 'linear-gradient(135deg,#00E6B4,#00A9D6)', icon: '◈' },
    error: { bg: 'linear-gradient(135deg,#E2622A,#FF8552)', icon: '✕' },
    info: { bg: 'linear-gradient(135deg,#0A84FF,#5E5CE6)', icon: 'i' },
    warning: { bg: 'linear-gradient(135deg,#FFB100,#FF8552)', icon: '!' },
  };
  const c = configs[type] || configs.info;

  return (
    <div style={{
      position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, animation: 'slideUp 0.3s ease',
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 40, padding: '10px 18px 10px 10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      whiteSpace: 'nowrap'
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', background: c.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 800, fontSize: 13, flexShrink: 0
      }}>
        {c.icon}
      </div>
      <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{message}</span>
    </div>
  );
});
Toast.displayName = 'Toast';

// Auth Screen
const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithEmailAndPassword(auth, identifier, password);
      let profile = await getUserProfile(result.user.uid);
      if (!profile) {
        await createUserProfile(result.user.uid, { email: identifier, username: identifier.split('@')[0] });
        profile = await getUserProfile(result.user.uid);
      }
      onLogin({ ...profile, id: result.user.uid });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createUserWithEmailAndPassword(auth, identifier, password);
      await createUserProfile(result.user.uid, {
        username,
        fullName,
        email: identifier,
        birthdate
      });
      const profile = await getUserProfile(result.user.uid);
      onLogin({ ...profile, id: result.user.uid });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#0C0907'
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg,#E2622A,#C9962E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 28
          }}>
            ◈
          </div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 22 }}>
            Social Resonance OS
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
            {isLogin ? 'Welcome back' : 'Join the resonance field'}
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(226,98,42,0.1)',
            border: '1px solid rgba(226,98,42,0.3)',
            borderRadius: 12,
            padding: '10px 14px',
            color: '#E2622A',
            fontSize: 12,
            marginBottom: 12
          }}>
            {error}
          </div>
        )}

        {!isLogin && (
          <>
            <input
              placeholder="Full Name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '13px 16px',
                color: 'white',
                marginBottom: 10,
                outline: 'none',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
            <input
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '13px 16px',
                color: 'white',
                marginBottom: 10,
                outline: 'none',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
            <input
              placeholder="Birthdate (YYYY-MM-DD)"
              value={birthdate}
              onChange={e => setBirthdate(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '13px 16px',
                color: 'white',
                marginBottom: 10,
                outline: 'none',
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </>
        )}

        <input
          placeholder="Email"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '13px 16px',
            color: 'white',
            marginBottom: 10,
            outline: 'none',
            fontSize: 14,
            boxSizing: 'border-box'
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '13px 16px',
            color: 'white',
            marginBottom: 14,
            outline: 'none',
            fontSize: 14,
            boxSizing: 'border-box'
          }}
        />

        <button
          onClick={isLogin ? handleLogin : handleSignup}
          disabled={loading || !identifier || !password || (!isLogin && (!username || !fullName || !birthdate))}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg,#E2622A,#C9962E)',
            border: 'none',
            borderRadius: 24,
            padding: 15,
            color: 'white',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 15,
            opacity: (loading || !identifier || !password) ? 0.5 : 1
          }}
        >
          {loading ? 'Please wait...' : (isLogin ? 'Enter Resonance' : 'Join Resonance Field')}
        </button>

        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 10
          }}
        >
          {isLogin ? "Don't have an account? Sign up →" : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================

export default function DaguV3App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [signals, setSignals] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [activeMode, setActiveMode] = useState('resonate'); // resonate, gather, transmit, reveal, trace
  const [toast, setToast] = useState(null);
  const [notifPopup, setNotifPopup] = useState(null);
  const [showTrace, setShowTrace] = useState(false);
  const [showTransmit, setShowTransmit] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);
  const isOnline = useNetworkStatus();

  // Firebase Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        let profile = await getUserProfile(fbUser.uid);
        if (!profile) {
          for (let i = 0; i < 3; i++) {
            await new Promise(r => setTimeout(r, 1000));
            profile = await getUserProfile(fbUser.uid);
            if (profile) break;
          }
        }
        if (profile) {
          setCurrentUser({ ...profile, id: fbUser.uid });
          setFollowed(profile.following || []);
          setBlockedUsers(profile.blockedUsers || []);
        } else {
          const fallback = buildDefaultProfile(fbUser.uid, {
            username: fbUser.displayName?.split(' ')[0]?.toLowerCase() || fbUser.email?.split('@')[0] || 'user',
            fullName: fbUser.displayName || '',
            email: fbUser.email || '',
            avatarUrl: fbUser.photoURL || null,
          });
          await createUserProfile(fbUser.uid, fallback);
          setCurrentUser(fallback);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Real-time Signals
  useEffect(() => {
    const q = query(collection(db, 'signals'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, snap => {
      setSignals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Real-time Users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Notification Popup
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);

  useEffect(() => {
    if (!currentUser?.id) return;
    let isFirst = true;
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', currentUser.id),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      if (isFirst) { isFirst = false; return; }
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const fromUser = usersRef.current.find(u => u.id === data.fromUserId);
          setNotifPopup({ notif: { ...data, id: change.doc.id }, user: fromUser });
        }
      });
    }, () => {});
    return () => unsub();
  }, [currentUser?.id]);

  // Handlers
  const handleLogin = async (profile) => {
    setCurrentUser(profile);
    setFollowed(profile.following || []);
    setBlockedUsers(profile.blockedUsers || []);
    showToast(`Welcome to Resonance, @${profile.username}! ◈`, 'success');
    await setDoc(doc(db, 'presence', profile.id), {
      online: true,
      lastSeen: serverTimestamp()
    }, { merge: true }).catch(() => {});
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    showToast('Left the resonance field', 'info');
  };

  const toggleFollow = async (uid) => {
    if (!currentUser) return;
    const isFollowing = followed.includes(uid);
    const newFollowed = isFollowing ? followed.filter(id => id !== uid) : [...followed, uid];
    setFollowed(newFollowed);
    await updateDoc(doc(db, 'users', currentUser.id), {
      following: isFollowing ? arrayRemove(uid) : arrayUnion(uid)
    });
    await updateDoc(doc(db, 'users', uid), {
      followers: isFollowing ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
    });
    if (!isFollowing) {
      await sendNotification(uid, currentUser.id, 'follow', 'resonates with you');
    }
  };

  const handleViewProfile = (uid) => {
    const user = users.find(u => u.id === uid);
    if (user) setViewingProfile(user);
  };

  // Loading State
  if (authLoading) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', height: '100dvh',
        background: '#0C0907',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16
      }}>
        <GlobalStyles />
        {!isOnline && <OfflineBanner />}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg,#E2622A,#C9962E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28
        }}>
          ◈
        </div>
        <div style={{
          width: 32, height: 32,
          border: '3px solid rgba(226,98,42,0.3)',
          borderTop: '3px solid #E2622A',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', height: '100dvh',
        background: '#0C0907',
        overflow: 'hidden'
      }}>
        <GlobalStyles />
        <AuthScreen onLogin={handleLogin} />
        {notifPopup && (
          <NotifPopup
            notif={notifPopup.notif}
            user={notifPopup.user}
            onClose={() => setNotifPopup(null)}
            onTap={() => { handleViewProfile(notifPopup.notif?.fromUserId); setNotifPopup(null); }}
          />
        )}
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // Main App
  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', height: '100dvh',
      background: '#0C0907',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <GlobalStyles />
      {!isOnline && <OfflineBanner />}

      {/* Profile Modal */}
      {viewingProfile && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'flex-end'
        }} onClick={() => setViewingProfile(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%',
            background: '#171310',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 20
          }}>
            <div style={{
              width: 36, height: 4,
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 2,
              margin: '0 auto 16px'
            }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: viewingProfile.avatarColor || '#E2622A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: 32,
                margin: '0 auto 12px',
                overflow: 'hidden'
              }}>
                {viewingProfile.avatarUrl ? <img src={viewingProfile.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : viewingProfile.avatar}
              </div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 20 }}>
                @{viewingProfile.username}
              </div>
              {viewingProfile.verified && (
                <div style={{ color: '#2F9BFF', fontSize: 12, marginTop: 4 }}>
                  ✓ Verified
                </div>
              )}
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 8 }}>
                {viewingProfile.bio || 'No bio'}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 24,
                marginTop: 16
              }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{formatNumber(viewingProfile.followers?.length || 0)}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Followers</div>
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>{formatNumber(viewingProfile.following?.length || 0)}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Following</div>
                </div>
              </div>
              <button
                onClick={() => {
                  toggleFollow(viewingProfile.id);
                  setViewingProfile(null);
                }}
                style={{
                  marginTop: 16,
                  padding: '10px 32px',
                  borderRadius: 24,
                  background: followed.includes(viewingProfile.id) ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#E2622A,#C9962E)',
                  border: followed.includes(viewingProfile.id) ? '1px solid rgba(226,98,42,0.4)' : 'none',
                  color: followed.includes(viewingProfile.id) ? '#E2622A' : 'white',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                {followed.includes(viewingProfile.id) ? 'Resonate' : '+ Resonate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trace Overlay */}
      {showTrace && (
        <TraceView
          signals={signals}
          users={users}
          onViewProfile={handleViewProfile}
          onClose={() => setShowTrace(false)}
        />
      )}

      {/* Transmit Overlay */}
      {showTransmit && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: 100,
          background: '#0C0907'
        }}>
          <button
            onClick={() => setShowTransmit(false)}
            style={{
              position: 'absolute', top: 12, right: 16,
              zIndex: 10,
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '50%',
              width: 36, height: 36,
              color: 'white',
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
          <TransmitSignal
            onTransmit={() => setShowTransmit(false)}
            showToast={showToast}
            currentUser={currentUser}
          />
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        <ResonanceFieldView
          signals={signals}
          currentUser={currentUser}
          followed={followed}
          showToast={showToast}
          onViewProfile={handleViewProfile}
          blockedUsers={blockedUsers}
          onResonate={(signalId) => {
            haptic('medium');
            showToast('◈ Resonating with signal', 'success');
          }}
          onGather={(signalId) => {
            haptic('medium');
            showToast('⌘ Gathering signal context', 'info');
          }}
          onTransmit={() => {
            haptic('heavy');
            setShowTransmit(true);
          }}
          onReveal={() => {
            haptic('medium');
            showToast('⊙ Revealing signal truth', 'info');
          }}
          onTrace={() => {
            haptic('medium');
            setShowTrace(true);
          }}
        />
      </div>

      {/* Navigation Bar */}
      <div style={{
        display: 'flex',
        background: 'rgba(6,6,8,0.98)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: `10px 4px max(26px, env(safe-area-inset-bottom))`,
        flexShrink: 0,
        backdropFilter: 'blur(30px)'
      }}>
        {[
          { key: 'resonate', symbol: '◈', label: 'Resonate' },
          { key: 'gather', symbol: '⌘', label: 'Gather' },
          { key: 'transmit', symbol: '⚡', label: 'Transmit' },
          { key: 'reveal', symbol: '⊙', label: 'Reveal' },
          { key: 'trace', symbol: '⋈', label: 'Trace' }
        ].map(tab => {
          const isActive = activeMode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                haptic('light');
                setActiveMode(tab.key);
                if (tab.key === 'transmit') {
                  setShowTransmit(true);
                } else if (tab.key === 'trace') {
                  setShowTrace(true);
                } else {
                  showToast(`${tab.symbol} ${tab.label} mode`, 'info');
                }
              }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 0',
                position: 'relative',
                transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)'
              }}
            >
              <div style={{ position: 'relative' }}>
                <span style={{
                  fontSize: 20,
                  color: isActive ? '#E2622A' : 'rgba(255,255,255,0.35)',
                  transition: 'color 0.2s'
                }}>
                  {tab.symbol}
                </span>
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: -6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#E2622A',
                    animation: 'bounceIn 0.3s ease'
                  }} />
                )}
              </div>
              <span style={{
                fontSize: 9,
                color: isActive ? '#E2622A' : 'rgba(255,255,255,0.28)',
                fontWeight: isActive ? 800 : 400,
                transition: 'color 0.2s',
                letterSpacing: 0.3
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notification Popup */}
      {notifPopup && (
        <NotifPopup
          notif={notifPopup.notif}
          user={notifPopup.user}
          onClose={() => setNotifPopup(null)}
          onTap={() => { handleViewProfile(notifPopup.notif?.fromUserId); setNotifPopup(null); }}
        />
      )}

      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
