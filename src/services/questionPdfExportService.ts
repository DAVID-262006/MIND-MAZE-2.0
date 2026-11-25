// ==============================================================================
// MIND MAZE 2.0 — QUESTION & ANSWER KEY PDF EXPORT SERVICE
// Pure frontend generation using jsPDF.
// Strictly offline / client-side. Zero questions or answers sent to Supabase.
// ==============================================================================

import { jsPDF } from 'jspdf';
import type { LocationCheckpoint } from '../types';
import { QuestionRegistry, type QuestionDefinition, type LocationRiddle, type CodeQuestion, type ThreePartQuestion } from '../features/questions';

export interface PdfExportOptions {
  isDraft?: boolean;
  versionLabel?: string;
  eventName?: string;
  locations?: LocationCheckpoint[];
}

export interface PdfExportResult {
  success: boolean;
  error?: string;
  filename?: string;
}

export class QuestionPdfExportService {
  /**
   * Generates and triggers download of a print-ready PDF containing all 9 locations,
   * questions, code blocks, three-part sub-questions, correct answers, and decoupled riddles.
   */
  public static async exportQuestionsAndAnswersPdf(options: PdfExportOptions = {}): Promise<PdfExportResult> {
    try {
      const questions: QuestionDefinition[] = QuestionRegistry.getAllQuestions();
      const riddles: LocationRiddle[] = QuestionRegistry.getAllRiddles();
      const locations: LocationCheckpoint[] = options.locations || [];

      if (!questions || questions.length === 0) {
        return {
          success: false,
          error: 'No questions configured to export. Please ensure questions are loaded in Question Management.',
        };
      }

      // Initialize portrait A4 document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
      const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const isDraft = Boolean(options.isDraft);
      const eventName = options.eventName || 'MIND MAZE 2.0';
      const versionLabel = options.versionLabel || 'v2.0-CHAMPIONSHIP';
      const exportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Helper to add footer with page numbers
      const addPageDecorations = (pageNumber: number, totalPagesPlaceholder = false) => {
        // Top subtle header rule (except cover/title block)
        if (pageNumber > 1) {
          doc.setDrawColor(220, 225, 235);
          doc.setLineWidth(0.75);
          doc.line(margin, 28, pageWidth - margin, 28);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(130, 140, 160);
          doc.text(`${eventName} — Game Questions & Official Answer Key`, margin, 22);

          if (isDraft) {
            doc.setTextColor(220, 38, 38);
            doc.setFont('helvetica', 'bold');
            doc.text('DRAFT — NOT PUBLISHED', pageWidth - margin - 120, 22);
          } else {
            doc.text(`CONFIDENTIAL &bull; ${versionLabel}`, pageWidth - margin - 100, 22);
          }
        }

        // Bottom footer rule
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.75);
        doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(140, 150, 170);
        doc.text(`Exported: ${exportDate} | Authorized Organizer & Marshal Copy`, margin, pageHeight - 18);

        const pageStr = `Page ${pageNumber}`;
        doc.text(pageStr, pageWidth - margin - doc.getTextWidth(pageStr), pageHeight - 18);
      };

      const checkPageBreak = (neededHeight: number): void => {
        if (y + neededHeight > pageHeight - 45) {
          doc.addPage();
          y = margin + 10;
        }
      };

      // =========================================================================
      // 1. COVER / HEADER BANNER
      // =========================================================================

      // Background Banner Box
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, y, contentWidth, 80, 'F');

      // Left Accent Strip
      doc.setFillColor(6, 182, 212); // cyan-500
      doc.rect(margin, y, 6, 80, 'F');

      // Title Text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('MIND MAZE 2.0 — Game Questions & Answer Key', margin + 20, y + 28);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Official Tournament Configuration &bull; 9 Stations &bull; Code & Three-Part Text Format`,
        margin + 20,
        y + 46
      );

      // Meta badge
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Generated: ${exportDate}  |  Version: ${versionLabel}  |  Security: Client-side Encrypted Key`,
        margin + 20,
        y + 64
      );

      y += 92;

      // Draft Warning Banner if Applicable
      if (isDraft) {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(248, 113, 113);
        doc.setLineWidth(1);
        doc.rect(margin, y, contentWidth, 24, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(185, 28, 28);
        doc.text('⚠ DRAFT — NOT PUBLISHED: This document contains unpublished draft questions or testing modifications.', margin + 12, y + 16);
        y += 32;
      }

      // =========================================================================
      // 2. TABLE OF CONTENTS / LOCATION SUMMARY INDEX
      // =========================================================================
      checkPageBreak(120);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('TABLE OF CONTENTS & STATION OVERVIEW', margin, y);
      y += 14;

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('ROUND / STATION', margin + 8, y + 12);
      doc.text('LOCATION NAME', margin + 110, y + 12);
      doc.text('QUESTION TITLE & TYPE', margin + 280, y + 12);
      y += 18;

      questions.forEach((q, idx) => {
        const roundNum = q.roundNumber;
        const loc = locations.find((l) => l.locationNumber === roundNum || l.id === roundNum);
        const locRiddle = riddles.find((r) => r.locationNumber === roundNum || r.locationId === roundNum);
        const locName = loc?.name || locRiddle?.locationName || `Station #${roundNum}`;

        doc.setFillColor(idx % 2 === 0 ? 255 : 248, 250, 252);
        doc.rect(margin, y, contentWidth, 16, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(`Station #${roundNum}`, margin + 8, y + 11);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const truncLoc = locName.length > 32 ? locName.substring(0, 30) + '...' : locName;
        doc.text(truncLoc, margin + 110, y + 11);

        const typeLabel = q.questionType === 'CODE_BASED' ? '[Code]' : '[3-Part Text]';
        const truncTitle = q.title.length > 35 ? q.title.substring(0, 33) + '...' : q.title;
        doc.text(`${typeLabel} ${truncTitle}`, margin + 280, y + 11);

        y += 16;
      });

      y += 24;

      // =========================================================================
      // 3. DETAILED QUESTION, ANSWER & RIDDLE BREAKDOWN (ALL 9 ROUNDS)
      // =========================================================================

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]!;
        const roundNum = q.roundNumber;
        const loc = locations.find((l) => l.locationNumber === roundNum || l.id === roundNum);
        const locRiddle = riddles.find((r) => r.locationNumber === roundNum || r.locationId === roundNum);
        const locName = loc?.name || locRiddle?.locationName || `Campus Station #${roundNum}`;
        const locDesc = loc?.description || locRiddle?.hint || '';

        // Force a clean new page for each station (except if first item has room)
        if (i > 0) {
          doc.addPage();
          y = margin + 10;
        }

        // Section Heading
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(1);
        doc.rect(margin, y, contentWidth, 34, 'FD');

        doc.setFillColor(14, 165, 233); // sky-500
        doc.rect(margin, y, 4, 34, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(`STATION #${roundNum} — ${locName}`, margin + 14, y + 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const subInfo = locDesc ? `Checkpoint: ${locDesc}` : `Designated Competition Round ${roundNum}`;
        doc.text(subInfo, margin + 14, y + 27);

        y += 44;

        // -----------------------------------------------------------------------
        // A. THE DECOUPLED LOCATION RIDDLE (Clearly separate from answers)
        // -----------------------------------------------------------------------
        doc.setFillColor(245, 243, 255); // purple-50
        doc.setDrawColor(221, 214, 254); // purple-200
        doc.setLineWidth(0.75);

        const riddleClue = locRiddle?.riddleClue || loc?.riddleClue || 'No navigation riddle configured.';
        const riddleLines = doc.splitTextToSize(riddleClue, contentWidth - 30);
        const riddleBoxHeight = Math.max(45, riddleLines.length * 11 + 28);

        checkPageBreak(riddleBoxHeight + 10);
        doc.rect(margin, y, contentWidth, riddleBoxHeight, 'FD');

        // Riddle Tag
        doc.setFillColor(147, 51, 234); // purple-600
        doc.rect(margin, y, 4, riddleBoxHeight, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(126, 34, 206); // purple-700
        doc.text('NAVIGATION RIDDLE (Revealed ONLY after question is correctly solved)', margin + 14, y + 14);

        doc.setFont('courier', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(59, 7, 100);
        doc.text(riddleLines, margin + 14, y + 27);

        y += riddleBoxHeight + 14;

        // -----------------------------------------------------------------------
        // B. QUESTION DETAILS & DESCRIPTION
        // -----------------------------------------------------------------------
        checkPageBreak(60);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        const typeBadge = q.questionType === 'CODE_BASED' ? 'CODE-BASED ALGORITHM' : 'THREE-PART TECHNICAL TRIAD';
        doc.text(`Question: ${q.title} (${typeBadge})`, margin, y);
        y += 14;

        // Clean Markdown formatting for PDF output
        const cleanDescription = q.descriptionMd
          .replace(/###/g, '')
          .replace(/```[a-z]*/g, '')
          .replace(/\*\*/g, '')
          .replace(/\\times/g, '×')
          .trim();

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const descLines = doc.splitTextToSize(cleanDescription, contentWidth);
        checkPageBreak(descLines.length * 11 + 10);
        doc.text(descLines, margin, y);
        y += descLines.length * 11 + 12;

        // -----------------------------------------------------------------------
        // C. QUESTION SPECIFICS (Code vs Three-Part)
        // -----------------------------------------------------------------------
        if (q.questionType === 'CODE_BASED') {
          const codeQ = q as CodeQuestion;

          // Starter Code Block
          if (codeQ.starterCode) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`Starter Code (${codeQ.language || 'javascript'}):`, margin, y);
            y += 10;

            const codeLines = doc.splitTextToSize(codeQ.starterCode, contentWidth - 20);
            const codeBoxHeight = codeLines.length * 10 + 14;

            checkPageBreak(codeBoxHeight + 10);
            doc.setFillColor(30, 41, 59); // slate-800
            doc.rect(margin, y, contentWidth, codeBoxHeight, 'F');

            doc.setFont('courier', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(241, 245, 249);
            doc.text(codeLines, margin + 10, y + 12);

            y += codeBoxHeight + 12;
          }

          // Test Cases & Correct Solution
          checkPageBreak(60);
          doc.setFillColor(240, 253, 244); // green-50
          doc.setDrawColor(187, 247, 208); // green-200
          doc.setLineWidth(0.75);

          const testCases = codeQ.testCases || [];
          const testLinesCount = Math.max(1, testCases.length);
          const ansBoxHeight = testLinesCount * 13 + 32;

          checkPageBreak(ansBoxHeight);
          doc.rect(margin, y, contentWidth, ansBoxHeight, 'FD');

          doc.setFillColor(34, 197, 94); // green-500
          doc.rect(margin, y, 4, ansBoxHeight, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(21, 128, 61); // green-700
          doc.text('OFFICIAL ACCEPTED TEST CASES & EXPECTED OUTPUTS', margin + 14, y + 14);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(22, 101, 52);

          let tcY = y + 27;
          testCases.forEach((tc, tcIdx) => {
            const visibility = tc.isHidden ? '[HIDDEN]' : '[SAMPLE]';
            doc.setFont('helvetica', 'bold');
            doc.text(`Case ${tcIdx + 1} ${visibility}:`, margin + 14, tcY);

            doc.setFont('courier', 'normal');
            doc.text(`Input: ${tc.input}  ->  Expected Output: ${tc.expectedOutput}`, margin + 115, tcY);
            tcY += 13;
          });

          y += ansBoxHeight + 10;

          // Validation instructions
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Validation Rules: Client-side JS sandbox execution. Must pass 100% of sample & hidden test cases. Max attempts: ${codeQ.maxAttempts || 10}.`,
            margin,
            y
          );
          y += 14;
        } else {
          // Three-Part Text Questions
          const threeQ = q as ThreePartQuestion;

          checkPageBreak(120);

          const parts = [
            { label: 'Part A', prompt: threeQ.promptA, answers: threeQ.acceptedAnswersA },
            { label: 'Part B', prompt: threeQ.promptB, answers: threeQ.acceptedAnswersB },
            { label: 'Part C', prompt: threeQ.promptC, answers: threeQ.acceptedAnswersC },
          ];

          parts.forEach((p) => {
            checkPageBreak(38);

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);

            const promptLines = doc.splitTextToSize(`${p.label}: ${p.prompt}`, contentWidth - 20);
            const pHeight = Math.max(34, promptLines.length * 10 + 20);

            doc.rect(margin, y, contentWidth, pHeight, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            doc.text(promptLines, margin + 10, y + 12);

            // Accepted Answers
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(16, 185, 129); // emerald-500
            const ansStr = p.answers && p.answers.length > 0 ? p.answers.map((a) => `"${a}"`).join('  OR  ') : '(None configured)';
            doc.text(`Accepted Answers: ${ansStr}`, margin + 10, y + pHeight - 7);

            y += pHeight + 6;
          });

          // Validation rules
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Validation Rules: Whitespace-normalized, case-${threeQ.caseSensitive ? 'sensitive' : 'insensitive'}. All 3 parts must be solved simultaneously.`,
            margin,
            y
          );
          y += 14;
        }

        // Hints
        if (q.hints && q.hints.length > 0) {
          checkPageBreak(25);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(120, 130, 150);
          const hintsText = q.hints.map((h, hIdx) => `Hint ${hIdx + 1}: ${h}`).join(' | ');
          const hintLines = doc.splitTextToSize(hintsText, contentWidth);
          doc.text(hintLines, margin, y);
          y += hintLines.length * 9 + 8;
        }
      }

      // =========================================================================
      // 4. ADD PAGE NUMBERS & HEADER/FOOTER TO ALL PAGES
      // =========================================================================
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        addPageDecorations(p);
      }

      // =========================================================================
      // 5. TRIGGER BROWSER DOWNLOAD
      // =========================================================================
      const dateSlug = new Date().toISOString().split('T')[0];
      const filename = `MIND_MAZE_2_0_Questions_And_Answers_${dateSlug}.pdf`;
      doc.save(filename);

      return {
        success: true,
        filename,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[QuestionPdfExportService] Failed to generate PDF:', err);
      return {
        success: false,
        error: `PDF generation failed: ${msg}`,
      };
    }
  }
}
