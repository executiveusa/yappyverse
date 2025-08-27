import { ConfigManager } from '../src/config/ConfigManager';
import { ToolBoxx } from '../src/core/ToolBoxx';

describe('THE TOOLBOXX', () => {
  describe('ConfigManager', () => {
    it('should initialize with default configuration', async () => {
      const config = await ConfigManager.initialize();
      
      expect(config).toBeDefined();
      expect(config.tools).toBeDefined();
      expect(config.tools.enabled).toContain('code-analysis');
      expect(config.tools.enabled).toContain('testing');
      expect(config.tools.enabled).toContain('security');
      expect(config.agent).toBeDefined();
      expect(config.agent.protocolVersion).toBe('1.0.0');
    });
  });

  describe('ToolBoxx', () => {
    it('should create ToolBoxx instance', async () => {
      const config = await ConfigManager.initialize();
      const toolboxx = new ToolBoxx(config);
      
      expect(toolboxx).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should have all seven tools available', async () => {
      const config = await ConfigManager.initialize();
      expect(config.tools.enabled).toHaveLength(7);
      
      const expectedTools = [
        'code-analysis',
        'testing', 
        'deployment',
        'monitoring',
        'security',
        'documentation',
        'collaboration'
      ];
      
      for (const tool of expectedTools) {
        expect(config.tools.enabled).toContain(tool);
      }
    });

    it('should support monetization features', async () => {
      const config = await ConfigManager.initialize();
      expect(config.monetization).toBeDefined();
      expect(config.monetization.subscriptionTier).toBeDefined();
    });

    it('should support agent protocol', async () => {
      const config = await ConfigManager.initialize();
      expect(config.agent).toBeDefined();
      expect(config.agent.port).toBeGreaterThan(0);
      expect(config.agent.id).toBeDefined();
    });

    it('should support voice commands', async () => {
      const config = await ConfigManager.initialize();
      expect(config.ui).toBeDefined();
      expect(typeof config.ui.voiceCommandsEnabled).toBe('boolean');
    });
  });
});