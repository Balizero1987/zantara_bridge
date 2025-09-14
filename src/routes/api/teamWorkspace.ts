import type { Router, Request, Response } from 'express';
import { createDriveFolder, uploadTextAsDoc } from '../../services/driveUpload';

export default function registerTeamWorkspace(r: Router) {
  
  // Setup team workspace with folders and initial documents
  r.post('/api/team/setup', async (req: Request, res: Response) => {
    try {
      const { 
        teamName = 'bali-zero',
        members = [],
        sharedFolders = ['Templates', 'Shared Documents', 'Meeting Notes', 'Client Files'],
        createWelcomeDoc = true
      } = req.body;
      
      if (!Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ error: 'Team members array required' });
      }
      
      const setupResults = {
        teamName,
        members: [],
        sharedFolders: [],
        welcomeDoc: null
      };
      
      // Create individual member folders
      for (const member of members) {
        try {
          const memberFolder = await createDriveFolder(member.toUpperCase());
          setupResults.members.push({
            name: member,
            folderId: memberFolder,
            status: 'created'
          });
          console.log(`✅ Created folder for ${member}: ${memberFolder}`);
        } catch (error) {
          console.error(`❌ Failed to create folder for ${member}:`, error);
          setupResults.members.push({
            name: member,
            folderId: null,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // Create shared team folders
      for (const folderName of sharedFolders) {
        try {
          const sharedFolder = await createDriveFolder(`SHARED_${folderName.replace(/\s+/g, '_').toUpperCase()}`);
          setupResults.sharedFolders.push({
            name: folderName,
            folderId: sharedFolder,
            status: 'created'
          });
          console.log(`✅ Created shared folder ${folderName}: ${sharedFolder}`);
        } catch (error) {
          console.error(`❌ Failed to create shared folder ${folderName}:`, error);
          setupResults.sharedFolders.push({
            name: folderName,
            folderId: null,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // Create team welcome document
      if (createWelcomeDoc) {
        try {
          const welcomeContent = `# Welcome to ${teamName.toUpperCase()} Team Workspace

## Team Members
${members.map(member => `- ${member.toUpperCase()}: Personal folder created`).join('\n')}

## Shared Resources
${sharedFolders.map(folder => `- ${folder}: Collaborative space for team`).join('\n')}

## Quick Start Guide

### For Team Members:
1. **Personal Folder**: Save your individual work in your named folder
2. **Shared Templates**: Use templates from the Templates folder
3. **Meeting Notes**: Collaborative meeting documentation
4. **Client Files**: Shared client-related documents

### Commands to Try:
- "Save this conversation to my folder"
- "Create meeting notes for today's standup"
- "Share this document with the team"
- "Search team documents for 'compliance'"

### Best Practices:
- Use descriptive file names with dates
- Tag documents with relevant keywords
- Keep shared folders organized
- Update meeting notes in real-time

---
Generated: ${new Date().toISOString()}
Team: ${teamName}
Members: ${members.length}
          `;
          
          const welcomeDoc = await uploadTextAsDoc(
            welcomeContent,
            `${teamName}_Team_Welcome_Guide`,
            'TEAM_ADMIN'
          );
          
          setupResults.welcomeDoc = welcomeDoc;
          console.log(`✅ Created welcome document: ${welcomeDoc.webViewLink}`);
        } catch (error) {
          console.error('❌ Failed to create welcome document:', error);
        }
      }
      
      res.json({
        success: true,
        message: `Team workspace setup completed for ${teamName}`,
        results: setupResults,
        summary: {
          membersCreated: setupResults.members.filter(m => m.status === 'created').length,
          sharedFoldersCreated: setupResults.sharedFolders.filter(f => f.status === 'created').length,
          totalMembers: members.length,
          totalSharedFolders: sharedFolders.length
        }
      });
      
    } catch (error: any) {
      console.error('Team setup error:', error);
      res.status(500).json({ 
        error: 'Team workspace setup failed',
        details: error.message 
      });
    }
  });
  
  // List team workspace structure
  r.get('/api/team/structure', async (req: Request, res: Response) => {
    try {
      const { listDriveFiles } = require('../../services/driveUpload');
      
      // Get all files to analyze team structure
      const allFiles = await listDriveFiles(undefined, 100);
      
      const teamStructure = {
        members: [],
        sharedFolders: [],
        recentActivity: []
      };
      
      // Analyze folder structure
      const foldersByType = allFiles.reduce((acc, file) => {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          if (file.name.startsWith('SHARED_')) {
            acc.shared.push(file);
          } else {
            acc.personal.push(file);
          }
        } else {
          acc.documents.push(file);
        }
        return acc;
      }, { shared: [], personal: [], documents: [] });
      
      teamStructure.members = foldersByType.personal.map(folder => ({
        name: folder.name,
        folderId: folder.id,
        createdTime: folder.createdTime,
        documentsCount: foldersByType.documents.filter(doc => 
          doc.name.toLowerCase().includes(folder.name.toLowerCase())
        ).length
      }));
      
      teamStructure.sharedFolders = foldersByType.shared.map(folder => ({
        name: folder.name.replace('SHARED_', ''),
        folderId: folder.id,
        createdTime: folder.createdTime
      }));
      
      teamStructure.recentActivity = foldersByType.documents
        .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
        .slice(0, 10)
        .map(doc => ({
          name: doc.name,
          type: doc.mimeType,
          createdTime: doc.createdTime,
          size: doc.size,
          webViewLink: doc.webViewLink
        }));
      
      res.json({
        success: true,
        teamStructure,
        summary: {
          totalMembers: teamStructure.members.length,
          totalSharedFolders: teamStructure.sharedFolders.length,
          totalDocuments: foldersByType.documents.length,
          lastActivity: teamStructure.recentActivity[0]?.createdTime || null
        }
      });
      
    } catch (error: any) {
      console.error('Team structure error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze team structure',
        details: error.message 
      });
    }
  });
  
  // Add member to existing team
  r.post('/api/team/add-member', async (req: Request, res: Response) => {
    try {
      const { memberName, role = 'member' } = req.body;
      
      if (!memberName) {
        return res.status(400).json({ error: 'Member name required' });
      }
      
      // Create personal folder for new member
      const memberFolder = await createDriveFolder(memberName.toUpperCase());
      
      // Create welcome document for new member
      const welcomeContent = `# Welcome ${memberName.toUpperCase()} to Bali Zero Team!

You've been added to the Zantara collaborative workspace.

## Your Personal Space
- **Folder ID**: ${memberFolder}
- **Access**: Full read/write to your personal folder
- **Shared Access**: Read access to team shared folders

## Getting Started
1. Start a conversation with ZANTARA
2. Identify yourself: "Hi, I'm ${memberName}"
3. Try: "Save this conversation to my folder"
4. Explore: "Show me team templates"

## Team Resources
- **Templates**: Pre-made documents for common tasks
- **Shared Documents**: Team collaboration space
- **Meeting Notes**: Collaborative meeting documentation
- **Client Files**: Shared client-related documents

Welcome to the team! 🎉

---
Generated: ${new Date().toISOString()}
Role: ${role}
      `;
      
      const welcomeDoc = await uploadTextAsDoc(
        welcomeContent,
        `${memberName}_Welcome_Package`,
        memberName.toUpperCase()
      );
      
      res.json({
        success: true,
        message: `Member ${memberName} added successfully`,
        member: {
          name: memberName,
          role: role,
          folderId: memberFolder,
          welcomeDoc: welcomeDoc.webViewLink,
          status: 'active'
        }
      });
      
    } catch (error: any) {
      console.error('Add member error:', error);
      res.status(500).json({ 
        error: 'Failed to add team member',
        details: error.message 
      });
    }
  });
}